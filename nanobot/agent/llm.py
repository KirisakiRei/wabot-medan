import json
import logging
import re
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger("nanobot.llm")


def parse_json_response(text: str) -> Optional[Dict]:
    """Parse output LLM menjadi dict dengan normalisasi toleran.

    Meniru pola fallback parse JSON pada AiService backend: strip code fence,
    normalisasi kutip tunggal, dan pembetulan nilai boolean Python.
    """

    if not text:
        return None

    cleaned = text.strip()

    # Hapus code fence bila model membungkus JSON di dalam ```json ... ```
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    fixed = cleaned
    fixed = fixed.replace("'", '"')
    fixed = re.sub(r"\bTrue\b", "true", fixed)
    fixed = re.sub(r"\bFalse\b", "false", fixed)
    fixed = re.sub(r"\bNone\b", "null", fixed)

    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        logger.warning("Gagal parse JSON dari LLM: %s", cleaned[:500])
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
        }

        try:
            # Path relatif tanpa awalan "/" agar base path (mis. /v1) dipertahankan
            # oleh httpx. Path absolut akan menimpa base path dan request nyasar.
            response = await self.client.post("chat/completions", json=payload)
            if response.status_code >= 400:
                logger.error("LLM HTTP %s: %s", response.status_code, response.text[:500])
            response.raise_for_status()

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

    async def chat_json(
        self,
        messages: List[Dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Optional[Dict]:
        content = await self.chat(messages, temperature, max_tokens)
        return parse_json_response(content)
