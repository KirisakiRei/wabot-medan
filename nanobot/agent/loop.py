import asyncio
import json
import logging
import time
from datetime import datetime, timezone
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
    """Orkestrasi turn percakapan: preflight → sinkronisasi state → interrupt
    → keputusan LLM → tool → balasan.

    Menggantikan peran `BotWithoutFlowService` + Gemini classifier pada backend,
    namun tetap menyerahkan seluruh business rule ke REST API backend.
    """

    # Peta route aktif ke file skill (dimuat hanya saat flow berjalan, hemat token)
    ROUTE_SKILL_FILES = {
        "INFORMATION": "information-service",
        "PROPOSAL": "proposal-service",
        "REPORT": "report-service",
    }

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

        # --------------------------------------------------------------------
        # 0. Preflight kebijakan backend (blocked/badword) - prioritas tertinggi
        # --------------------------------------------------------------------
        policy = await self.pemko_client.preflight(request.channel_user_id, request.text)

        if policy and policy.get("data", {}).get("action") in ("BLOCKED", "REJECT", "RATE_LIMITED"):
            message = (
                policy.get("data", {}).get("message")
                or "Maaf, pesan Anda tidak dapat diproses saat ini."
            )
            logger.info(
                "Turn ditolak kebijakan session_key=%s action=%s",
                session_key,
                policy.get("data", {}).get("action"),
            )
            return self._build_response(
                state,
                ToolResult(message=message, route="ASSISTANT"),
                [],
            )

        # --------------------------------------------------------------------
        # 0b. Sinkronkan state & riwayat dari backend (fallback ke lokal)
        # --------------------------------------------------------------------
        await self._sync_session(session, state, request)

        self.session_store.append_history(session_key, "user", request.text)
        history = self.session_store.history(session_key)

        tool_calls: List[str] = []
        result: Optional[ToolResult] = None

        # --------------------------------------------------------------------
        # 1. Interrupt deterministik: warga membatalkan form yang sedang berjalan
        # --------------------------------------------------------------------
        if state.get("route") in ("PROPOSAL", "REPORT") and self._is_cancel(request.text):
            tool_name = "cancel_proposal" if state.get("route") == "PROPOSAL" else "cancel_complaint"
            tool_calls.append(tool_name)
            result = await self._execute_tool(tool_name, {}, state)

        # --------------------------------------------------------------------
        # 2. Media masuk saat alur aktif menerima bukti/file
        # --------------------------------------------------------------------
        elif state.get("route") == "PROPOSAL" and request.media:
            tool_calls.append("update_proposal_field")
            result = await self._execute_tool(
                "update_proposal_field",
                {"value": request.media.url},
                state,
            )

        elif state.get("route") == "REPORT" and request.media:
            # Media saat menunggu konfirmasi draft lama dianggap sebagai lanjut
            state["resume_waiting"] = False
            tool_calls.append("append_complaint")
            result = await self._execute_tool(
                "append_complaint",
                {"media_url": request.media.url},
                state,
            )

        # --------------------------------------------------------------------
        # 2b. Konfirmasi draft pengaduan lama (lanjutkan / mulai baru)
        # --------------------------------------------------------------------
        elif state.get("route") == "REPORT" and state.get("resume_waiting"):
            result = await self._handle_resume_decision(request.text, state, tool_calls)

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

        response = self._build_response(state, result, tool_calls)

        # --------------------------------------------------------------------
        # 5. Persist state & riwayat ke backend (best effort)
        # --------------------------------------------------------------------
        context_dict = (
            response.context.model_dump()
            if hasattr(response.context, "model_dump")
            else response.context
        )
        await self.pemko_client.set_conversation(
            session_key,
            context_dict,
            session["history"],
        )

        # --------------------------------------------------------------------
        # 6. Trigger compact memory (background, tidak menambah latensi turn)
        # --------------------------------------------------------------------
        if self._should_compact(state, session["history"]):
            asyncio.create_task(
                self._compact_async(session_key, state, list(session["history"]))
            )

        return response

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

    async def _handle_resume_decision(self, text: str, state: dict, tool_calls: List[str]) -> ToolResult:
        """Keputusan deterministik atas konfirmasi draft pengaduan lama."""

        lowered = text.lower().strip()
        keyword = state.get("complaint_keyword") or "kirim"

        if any(word in lowered for word in ("lanjut", "ya", "iya", "oke", "ok", "teruskan", "sambung", "continue")):
            state["resume_waiting"] = False
            return ToolResult(
                message=(
                    f"Baik, lanjutkan pengaduan Anda. Silakan tulis deskripsi atau "
                    f"kirim bukti tambahan, atau ketik *{keyword}* untuk mengirimkan pengaduan."
                ),
                route="REPORT",
            )

        if any(word in lowered for word in ("baru", "mulai baru", "buat baru", "reset", "ganti", "tidak", "nggak", "jangan lanjut")):
            state["resume_waiting"] = False
            tool_calls.append("cancel_complaint")
            await self._execute_tool("cancel_complaint", {}, state)
            tool_calls.append("start_complaint")
            return await self._execute_tool("start_complaint", {}, state)

        return ToolResult(
            message=(
                "Mohon konfirmasi: balas *lanjut* untuk melanjutkan pengaduan "
                "sebelumnya, atau *mulai baru* untuk membuat pengaduan baru."
            ),
            route="REPORT",
        )

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
    # SINKRONISASI STATE & RIWAYAT (backend sebagai sumber, lokal sebagai cache)
    # ========================================================================
    async def _sync_session(self, session: dict, state: dict, request: NanobotTurnRequest):
        """Ambil state/riwayat/memory terbaru dari backend bila tersedia.

        Prioritas: context dari request (WA path sudah menyertakan), lalu GET
        endpoint conversations. History diambil dari backend agar selamat dari
        restart engine. Semua kegagalan → fallback ke session lokal.
        """
        remote = await self.pemko_client.get_conversation(request.session_key)
        data = (remote or {}).get("data") or {}

        context = request.context or data.get("context")
        remote_history = data.get("history") or []

        state["compact_memory"] = data.get("memory")
        state["last_activity_at"] = data.get("last_activity_at")

        # Gunakan history backend hanya bila session lokal kosong (hindari duplikat)
        if remote_history and not session["history"]:
            session["history"] = remote_history[-self.config.history_limit:]

        if context is not None:
            self._apply_context(state, context)

    def _apply_context(self, state: dict, context) -> None:
        if hasattr(context, "model_dump"):
            context = context.model_dump()
        elif not isinstance(context, dict):
            return

        route = context.get("active_route") or "NONE"
        if route in ("NONE", "INFORMATION", "PROPOSAL", "REPORT", "TICKET", "ASSISTANT", "IRRELEVANT"):
            state["route"] = route

        state["step"] = context.get("current_step", 0)
        state["service"] = context.get("service")
        state["forms"] = context.get("forms") or []
        state["pending_form_id"] = context.get("pending_form_id")
        state["ticket"] = context.get("ticket")

    # ========================================================================
    # COMPACT MEMORY - Ringkas riwayat saat gap lama / history penuh
    # ========================================================================
    @staticmethod
    def _parse_timestamp(value) -> float:
        if not value:
            return 0.0
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0

    def _should_compact(self, state: dict, history: List[dict]) -> bool:
        if not history:
            return False

        # Cooldown: jangan compact berulang dalam waktu singkat
        memory = state.get("compact_memory") or {}
        last_summary = memory.get("last_activity_at")
        if last_summary:
            elapsed = time.time() - self._parse_timestamp(last_summary)
            if elapsed < self.config.compact_cooldown_hours * 3600:
                return False

        # Trigger 1: history penuh
        if len(history) >= self.config.history_limit:
            return True

        # Trigger 2: gap waktu antar percakapan
        last_activity = state.get("last_activity_at")
        if last_activity:
            elapsed = time.time() - self._parse_timestamp(last_activity)
            if elapsed >= self.config.compact_gap_minutes * 60:
                return True

        return False

    async def _compact_async(self, session_key: str, state: dict, history: List[dict]):
        """Summarize background; semua kegagalan hanya dicatat, tidak merusak alur."""

        try:
            old_memory = state.get("compact_memory") or {}
            summary = await self._summarize(old_memory, history)

            if summary is None:
                logger.warning("Compact dibatalkan %s: ringkasan gagal dibuat", session_key)
                return

            await self.pemko_client.compact_conversation(session_key, summary, len(history))

            # Cache lokal agar blok ringkasan tersedia langsung turn berikutnya
            state["compact_memory"] = {
                "summary": summary,
                "message_count": len(history),
                "last_activity_at": datetime.now(timezone.utc).isoformat(),
            }

            # Trim history lokal agar tetap ramping
            session = self.session_store.get(session_key)
            keep = self.config.compact_trim_keep
            if len(session["history"]) > keep:
                session["history"] = session["history"][-keep:]
                self.session_store.save(session_key)

            logger.info("Compact selesai session_key=%s messages=%s", session_key, len(history))
        except Exception as error:
            logger.warning("Gagal compact percakapan %s: %s", session_key, error)

    async def _summarize(self, old_memory: dict, history: List[dict]) -> Optional[dict]:
        system = (
            "Anda adalah perangkum percakapan layanan publik Pemko. Ringkas riwayat "
            "percakapan menjadi JSON TUNGGAL tanpa teks lain dengan format: "
            '{"summary": "ringkasan 3-5 kalimat", "topics": ["topik yang dibahas"], '
            '"preferences": ["preferensi warga"], "pending_items": ["hal yang belum selesai"]}. '
            "Fokus pada: topik yang dibahas, layanan yang diurus, kode tiket, preferensi "
            "warga, dan hal yang belum tuntas. JANGAN sertakan data sensitif seperti "
            "nomor identitas atau alamat lengkap."
        )

        messages: List[dict] = [{"role": "system", "content": system}]

        old_summary = old_memory.get("summary") if old_memory else None
        if old_summary:
            messages.append({
                "role": "system",
                "content": f"Ringkasan sebelumnya (gabungkan, jangan buang):\n{json.dumps(old_summary, ensure_ascii=False)}",
            })

        messages.append({
            "role": "user",
            "content": "Riwayat percakapan:\n" + json.dumps(history, ensure_ascii=False),
        })

        return await self.llm_client.chat_json(
            messages,
            temperature=0.1,
            max_tokens=self.config.llm_max_tokens,
        )

    # ========================================================================
    # BUILDING BLOCKS
    # ========================================================================
    def _build_system_prompt(self, state: dict) -> str:
        soul = self._read_prompt("soul.md")
        skills = self._read_prompt("skills.md")
        routing = self._read_prompt("ROUTING.md")
        safety = self._read_prompt("SAFETY.md")
        active_skill = self._read_active_skill(state.get("route", "NONE"))

        memory_block = self._build_memory_block(state)

        tools_block = "--- DAFTAR TOOL TERSEDIA ---\n" + tool_descriptions()

        sections = [soul, memory_block, skills, routing, safety]
        if active_skill:
            sections.append(active_skill)
        sections.append(tools_block)

        return "\n\n".join(section for section in sections if section)

    def _read_active_skill(self, route: str) -> str:
        """Muat skill khusus flow aktif agar konteks tetap relevan & hemat token."""

        skill_dir = self.ROUTE_SKILL_FILES.get(route)
        if not skill_dir:
            return ""

        try:
            return (self.prompt_dir / "skills" / skill_dir / "SKILL.md").read_text(encoding="utf-8")
        except Exception as error:
            logger.warning("Gagal membaca skill %s: %s", skill_dir, error)
            return ""

    def _build_memory_block(self, state: dict) -> str:
        memory_template = self._read_prompt("memory.md")
        service = state.get("service")
        ticket = state.get("ticket")

        route = state.get("route", "NONE")
        step = str(state.get("step", 0))
        ticket_val = str(ticket) if ticket else "null"

        collected = []
        if service and service.get("request_name"):
            collected.append(f"Layanan: {service.get('request_name')}")
        collected.append(f"Menunggu isian form: {'ya' if state.get('pending_form_id') else 'tidak'}")
        collected_str = "; ".join(collected)

        injected = memory_template.replace("{INJECT_ROUTE}", route)
        injected = injected.replace("{INJECT_STEP}", step)
        injected = injected.replace("{INJECT_TICKET_ID}", ticket_val)
        injected = injected.replace("{INJECT_COLLECTED_DATA}", collected_str)

        compact = state.get("compact_memory") or {}
        if compact.get("summary"):
            injected += "\n\n<RINGKASAN_SEBELUMNYA>\n"
            injected += json.dumps(compact.get("summary"), ensure_ascii=False)
            injected += "\n</RINGKASAN_SEBELUMNYA>"

        return injected

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
            forms=state.get("forms") or [],
            pending_form_id=state.get("pending_form_id"),
            ticket=state.get("ticket"),
        )

        return NanobotTurnResponse(
            route=result.route,
            reply=reply,
            tool_calls=tool_calls,
            not_found=result.not_found,
            not_found_session=result.not_found_session,
            context=context,
        )
