import json
import logging
import re
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger("nanobot.llm")


def parse_json_response(text: str) -> Optional[Dict]:
    """Parse output LLM menjadi dict dengan normalisasi toleran.

    Meniru pola fallback parse JSON pada AiService backend: strip code fence,
    ekstraksi objek JSON seimbang (menoleransi teks tambahan), normalisasi
    kutip tunggal, dan pembetulan nilai boolean Python.
    """

    if not text:
        return None

    cleaned = text.strip()

    # Hapus code fence bila model membungkus JSON di dalam ```json ... ```
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    def _loads(candidate: str) -> Optional[Dict]:
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    # 1. Parsing langsung
    parsed = _loads(cleaned)
    if parsed is not None:
        return parsed

    # 2. Ekstraksi objek JSON pertama yang braketnya seimbang (toleran
    #    terhadap teks trailing dari model)
    extracted = _extract_balanced_json(cleaned)
    if extracted:
        parsed = _loads(extracted)
        if parsed is not None:
            return parsed

    # 3. Beberapa model menulis newline literal di dalam nilai string (tidak
    #    valid JSON). Ratakan newline/tab → spasi lalu coba lagi.
    for candidate in (cleaned, extracted):
        if not candidate:
            continue
        collapsed = " ".join(candidate.split())
        parsed = _loads(collapsed)
        if parsed is not None:
            return parsed

    # 4. Normalisasi kutip tunggal + boolean Python (fallback terakhir)
    fixed = cleaned
    fixed = fixed.replace("'", '"')
    fixed = re.sub(r"\bTrue\b", "true", fixed)
    fixed = re.sub(r"\bFalse\b", "false", fixed)
    fixed = re.sub(r"\bNone\b", "null", fixed)

    parsed = _loads(fixed)
    if parsed is not None:
        return parsed

    logger.warning("Gagal parse JSON dari LLM: %s", cleaned[:500])
    return None


def _extract_balanced_json(text: str) -> Optional[str]:
    """Ambil substring dari `{` pertama hingga `}` yang menutupnya."""

    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(text)):
        char = text[index]

        if escape:
            escape = False
            continue

        if char == "\\" and in_string:
            escape = True
            continue

        if char == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]

    return None


class LLMClient:
    """Klien LLM OpenAI-compatible (Ollama / vLLM / Gemini OpenAI API)."""

    def __init__(self, config):
        self.base_url = config.llm_base_url
        self.model = config.llm_model
        self.temperature = config.llm_temperature
        self.max_tokens = config.llm_max_tokens
        self.timeout = config.llm_timeout
        self.api_key = config.llm_api_key

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout, headers=headers)

    async def close(self):
        await self.client.aclose()

    async def chat(
        self,
        messages: List[Dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Optional[str]:
        """Panggil /chat/completions dan kembalikan teks isi jawaban model."""

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.max_tokens,
            "stream": False,
        }

        try:
            # Path relatif tanpa awalan "/" agar base path (mis. /v1) dipertahankan
            # oleh httpx. Path absolut akan menimpa base path dan request nyasar.
            response = await self.client.post("chat/completions", json=payload)
            if response.status_code >= 400:
                logger.error("LLM HTTP %s: %s", response.status_code, response.text[:500])
            response.raise_for_status()

            raw_text = response.text
            if raw_text.lstrip().startswith("data:"):
                return self._parse_sse_response(raw_text)

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return self._content_to_text(content)
        except Exception as error:
            logger.error("Error call LLM: %s", error)
            return None

    @staticmethod
    def _content_to_text(content) -> Optional[str]:
        """Normalisasi isi jawaban: string biasa atau list (format vision)."""

        if content is None:
            return None
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "text":
                        parts.append(part.get("text", ""))
                    elif "text" in part:
                        parts.append(str(part["text"]))
                else:
                    parts.append(str(part))
            return "".join(parts)
        return str(content)

    @staticmethod
    def _parse_sse_response(text: str) -> Optional[str]:
        """Fallback untuk router yang tetap mengembalikan SSE walau stream=false."""

        parts = []
        for line in text.splitlines():
            line = line.strip()
            if not line.startswith("data:"):
                continue

            payload = line.removeprefix("data:").strip()
            if not payload or payload == "[DONE]":
                continue

            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                continue

            for choice in data.get("choices", []):
                delta = choice.get("delta") or {}
                if "content" in delta:
                    parts.append(delta.get("content") or "")
                message = choice.get("message") or {}
                if "content" in message:
                    parts.append(message.get("content") or "")

        return "".join(parts) if parts else None

    async def chat_json(
        self,
        messages: List[Dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Optional[Dict]:
        content = await self.chat(messages, temperature, max_tokens)
        return parse_json_response(content)
