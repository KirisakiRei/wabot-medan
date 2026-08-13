import os
from pathlib import Path

from dotenv import load_dotenv

# Muat file .env di folder engine (jika ada) agar mudah dikonfigurasi
load_dotenv(Path(__file__).resolve().parent / ".env")


class Config:
    """Konfigurasi engine Nanobot Pemko.

    Semua nilai dibaca dari environment variable dengan fallback default,
    mengikuti pola `process.env.X || default` pada project backend NestJS.
    """

    def __init__(self):
        # --------------------------------------------------------------------
        # Autentikasi service-to-service (sama dengan backend)
        # --------------------------------------------------------------------
        self.service_token = os.getenv("NANOBOT_SERVICE_TOKEN", "")

        # --------------------------------------------------------------------
        # Koneksi ke backend NestJS (Business Brain)
        # --------------------------------------------------------------------
        self.backend_url = os.getenv("NANOBOT_BACKEND_URL", "http://localhost:8001")
        self.backend_token = os.getenv("NANOBOT_BACKEND_API_KEY", "") or self.service_token
        self.backend_timeout = float(os.getenv("NANOBOT_BACKEND_TIMEOUT", "30"))

        # --------------------------------------------------------------------
        # LLM provider (OpenAI-compatible: Ollama / vLLM / Gemini OpenAI API)
        # --------------------------------------------------------------------
        self.llm_base_url = os.getenv("NANOBOT_LLM_BASE_URL", "http://localhost:11434/v1")
        self.llm_api_key = os.getenv("NANOBOT_LLM_API_KEY", "")
        self.llm_model = os.getenv("NANOBOT_LLM_MODEL", "llama3.1")
        self.llm_temperature = float(os.getenv("NANOBOT_LLM_TEMPERATURE", "0.2"))
        self.llm_max_tokens = int(os.getenv("NANOBOT_LLM_MAX_TOKENS", "1024"))
        self.llm_timeout = float(os.getenv("NANOBOT_LLM_TIMEOUT", "120"))

        # --------------------------------------------------------------------
        # Runtime engine
        # --------------------------------------------------------------------
        self.port = int(os.getenv("NANOBOT_PORT", "8765"))
        self.workspace = os.getenv(
            "NANOBOT_WORKSPACE",
            str(Path(__file__).resolve().parent / "workspace"),
        )
        self.history_limit = int(os.getenv("NANOBOT_HISTORY_LIMIT", "20"))


config = Config()
