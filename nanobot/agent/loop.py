import logging
from pathlib import Path
from typing import Dict, List, Optional

from models import (
    NanobotReply,
    NanobotService,
    NanobotTurnContext,
    NanobotTurnRequest,
    NanobotTurnResponse,
)
from tools.registry import TOOL_REGISTRY, tool_descriptions
from tools.types import ToolResult

logger = logging.getLogger("nanobot.agent")


class AgentLoop:
    """Orkestrasi turn percakapan: interrupt → keputusan LLM → tool → balasan.

    Menggantikan peran `BotWithoutFlowService` + Gemini classifier pada backend,
    namun tetap menyerahkan seluruh business rule ke REST API backend.
    """

    def __init__(self, config, session_store, llm_client, pemko_client, tool_registry):
        self.config = config
        self.session_store = session_store
        self.llm_client = llm_client
        self.pemko_client = pemko_client
        self.tool_registry = tool_registry

        self.prompt_dir = Path(__file__).resolve().parent.parent / "prompts"

        self.cancel_words = (
            "batal",
            "batalkan",
            "cancel",
            "jangan jadi",
            "gak jadi",
            "tidak jadi",
            "stop",
            "berhenti",
            "ulang",
        )

    # ========================================================================
    # MAIN TURN
    # ========================================================================
    async def handle_turn(self, request: NanobotTurnRequest) -> NanobotTurnResponse:
        session_key = request.session_key
        session = self.session_store.get(session_key)
        state = session["state"]

        state.setdefault("wa_number", request.channel_user_id)

        self.session_store.append_history(session_key, "user", request.text)
        history = self.session_store.history(session_key)

        tool_calls: List[str] = []
        result: Optional[ToolResult] = None

        # --------------------------------------------------------------------
        # 1. Interrupt deterministik: warga membatalkan form yang sedang berjalan
        # --------------------------------------------------------------------
        if state.get("route") == "PROPOSAL" and self._is_cancel(request.text):
            tool_calls.append("cancel_proposal")
            result = await self._execute_tool("cancel_proposal", {}, state)

        # --------------------------------------------------------------------
        # 2. Media masuk saat form aktif bertipe file
        # --------------------------------------------------------------------
        elif state.get("route") == "PROPOSAL" and request.media:
            tool_calls.append("update_proposal_field")
            result = await self._execute_tool(
                "update_proposal_field",
                {"value": request.media.url},
                state,
            )

        # --------------------------------------------------------------------
        # 3. Keputusan LLM (routing + jawaban)
        # --------------------------------------------------------------------
        elif result is None:
            result = await self._decide_and_execute(history, state, tool_calls)

        # --------------------------------------------------------------------
        # 4. Siapkan balasan
        # --------------------------------------------------------------------
        message = result.message or "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti."

        self.session_store.append_history(session_key, "assistant", message)
        self.session_store.save(session_key)

        # Log turn ke backend (best effort, tidak mengganggu alur utama)
        await self.pemko_client.log_turn(
            channel_user_id=request.channel_user_id,
            user_message=request.text,
            bot_reply=message,
            route=result.route,
            tool_calls=tool_calls,
        )

        logger.info(
            "Turn selesai session_key=%s route=%s tools=%s",
            session_key,
            result.route,
            tool_calls,
        )

        return self._build_response(state, result, tool_calls)

    # ========================================================================
    # KEPUTUSAN LLM & EKSEKUSI TOOL
    # ========================================================================
    async def _decide_and_execute(
        self,
        history: List[dict],
        state: dict,
        tool_calls: List[str],
    ) -> ToolResult:
        system_prompt = self._build_system_prompt(state)

        messages = [
            {"role": "system", "content": system_prompt},
            *history,
        ]

        decision = await self.llm_client.chat_json(
            messages,
            temperature=0.2,
            max_tokens=self.config.llm_max_tokens,
        )

        if decision is None:
            return ToolResult(
                message="Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                route=state.get("route", "NONE"),
            )

        action = decision.get("action") or "reply"

        # --------------------------------------------------------------------
        # Jalur tool
        # --------------------------------------------------------------------
        if action == "tool":
            tool_name = decision.get("tool") or ""

            if tool_name not in self.tool_registry:
                logger.warning("Tool tidak dikenal: %s", tool_name)
                return ToolResult(
                    message="Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                    route=state.get("route", "NONE"),
                )

            tool_calls.append(tool_name)
            arguments = decision.get("arguments") or {}
            return await self._execute_tool(tool_name, arguments, state)

        # --------------------------------------------------------------------
        # Jalur jawaban langsung
        # --------------------------------------------------------------------
        reply_text = (decision.get("reply") or "").strip()

        if not reply_text:
            return ToolResult(
                message="Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                route=state.get("route", "NONE"),
            )

        route = decision.get("route") or "ASSISTANT"
        if route not in ("ASSISTANT", "IRRELEVANT"):
            route = "ASSISTANT"

        return ToolResult(message=reply_text, route=route)

    async def _execute_tool(self, tool_name: str, arguments: dict, state: dict) -> ToolResult:
        try:
            handler = self.tool_registry[tool_name]["execute"]
            return await handler(self.pemko_client, arguments, state)
        except Exception as error:
            logger.error("Error eksekusi tool %s: %s", tool_name, error)
            return ToolResult(
                message="Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.",
                route=state.get("route", "NONE"),
            )

    # ========================================================================
    # BUILDING BLOCKS
    # ========================================================================
    def _build_system_prompt(self, state: dict) -> str:
        soul = self._read_prompt("soul.md")
        memory = self._read_prompt("memory.md")
        skills = self._read_prompt("skills.md")
        routing = self._read_prompt("ROUTING.md")
        safety = self._read_prompt("SAFETY.md")

        memory_block = self._build_memory_block(state)

        tools_block = "--- DAFTAR TOOL TERSEDIA ---\n" + tool_descriptions()

        return (
            f"{soul}\n\n{memory}\n\n{skills}\n\n{routing}\n\n{safety}\n\n"
            f"{memory_block}\n\n{tools_block}"
        )

    def _build_memory_block(self, state: dict) -> str:
        service = state.get("service")
        return (
            "--- INGATAN AKTIF ---\n"
            f"Route aktif: {state.get('route', 'NONE')}\n"
            f"Langkah form: {state.get('step', 0)}\n"
            f"Layanan: {service.get('request_name') if service else 'tidak ada'}\n"
            f"Menunggu isian form: {'ya' if state.get('pending_form_id') else 'tidak'}\n"
        )

    def _read_prompt(self, name: str) -> str:
        try:
            return (self.prompt_dir / name).read_text(encoding="utf-8")
        except Exception as error:
            logger.warning("Gagal membaca prompt %s: %s", name, error)
            return ""

    def _is_cancel(self, text: str) -> bool:
        lowered = text.lower().strip()
        return any(word in lowered for word in self.cancel_words)

    def _build_response(
        self,
        state: dict,
        result: ToolResult,
        tool_calls: List[str],
    ) -> NanobotTurnResponse:
        reply = NanobotReply(
            type=result.reply_type,
            text=result.message,
            file_url=result.file_url,
            latitude=result.latitude,
            longitude=result.longitude,
        )

        service = state.get("service")
        service_model = (
            NanobotService(
                request_id=service["request_id"],
                request_name=service["request_name"],
            )
            if service
            else None
        )

        context = NanobotTurnContext(
            active_route=result.route,
            current_step=state.get("step", 0),
            last_response=result.message,
            request_id=service["request_id"] if service else None,
            service=service_model,
        )

        return NanobotTurnResponse(
            route=result.route,
            reply=reply,
            tool_calls=tool_calls,
            not_found=result.not_found,
            not_found_session=result.not_found_session,
            context=context,
        )
