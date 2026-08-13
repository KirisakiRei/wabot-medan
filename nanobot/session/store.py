import json
import logging
from pathlib import Path
from typing import Dict, List

logger = logging.getLogger("nanobot.session")


def default_state() -> dict:
    """State awal alur percakapan (workflow pointer, bukan business truth)."""

    return {
        "route": "NONE",
        "step": 0,
        "service": None,
        "forms": [],
        "pending_form_id": None,
        "ticket": None,
    }


class SessionStore:
    """Penyimpanan sesi per user.

    Riwayat percakapan & state alur disimpan per session_key (misal
    `wa:628123456789`). Disimpan juga ke file JSON di workspace agar selamat
    dari restart proses (mengikuti prinsip durabilitas pada PRD).
    """

    def __init__(self, config):
        self.history_limit = config.history_limit
        self.session_dir = Path(config.workspace) / "sessions"
        self.session_dir.mkdir(parents=True, exist_ok=True)

        self.sessions: Dict[str, dict] = {}
        self._load_all()

    def _session_file(self, session_key: str) -> Path:
        safe_key = session_key.replace(":", "_").replace("/", "_")
        return self.session_dir / f"{safe_key}.json"

    def _load_all(self):
        for file in self.session_dir.glob("*.json"):
            try:
                session_key = file.stem.replace("_", ":", 1)
                with open(file, "r", encoding="utf-8") as f:
                    self.sessions[session_key] = json.load(f)
            except Exception as error:
                logger.warning("Gagal memuat file sesi %s: %s", file, error)

    def get(self, session_key: str) -> dict:
        session = self.sessions.get(session_key)

        if session is None:
            session = {
                "history": [],
                "state": default_state(),
            }
            self.sessions[session_key] = session

        return session

    def append_history(self, session_key: str, role: str, content: str):
        session = self.get(session_key)
        session["history"].append({"role": role, "content": content})

        # Batasi panjang riwayat agar tidak membengkak
        if len(session["history"]) > self.history_limit:
            session["history"] = session["history"][-self.history_limit:]

    def history(self, session_key: str) -> List[dict]:
        return self.get(session_key)["history"]

    def clear_history(self, session_key: str):
        self.get(session_key)["history"] = []

    def save(self, session_key: str):
        session = self.get(session_key)

        try:
            with open(self._session_file(session_key), "w", encoding="utf-8") as f:
                json.dump(session, f, ensure_ascii=False, indent=2)
        except Exception as error:
            logger.warning("Gagal menyimpan sesi %s: %s", session_key, error)
