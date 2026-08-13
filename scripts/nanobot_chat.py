#!/usr/bin/env python3
"""Interactive terminal chat client for Nanobot.

Usage:
  python scripts/nanobot_chat.py
  python scripts/nanobot_chat.py --url http://127.0.0.1:8766 --user terminal-user-001

The script auto-loads `.env` and `nanobot/.env` if present, then calls:
  POST <url>/api/v1/turns
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_dotenv(path: Path) -> None:
    """Tiny dotenv loader; does not override existing env."""

    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def now_wib_label() -> str:
    # Server VPS biasanya sudah WIB/UTC sesuai konfigurasi OS. Untuk test terminal,
    # label waktu bebas; backend tidak memerlukan format ISO.
    return datetime.now().strftime("%H:%M WIB")


def post_json(url: str, token: str, payload: Dict[str, Any], timeout: int = 120) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8")
            return json.loads(text)
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {text}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Connection error: {error}") from error


def build_payload(
    *,
    message_id: str,
    channel: str,
    user_id: str,
    text: str,
    sender_name: str,
    session_key: str,
    context: Optional[Dict[str, Any]],
    media: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "message_id": message_id,
        "channel": channel,
        "channel_user_id": user_id,
        "text": text,
        "media": media,
        "sender_name": sender_name,
        "message_time": now_wib_label(),
        "session_key": session_key,
        "context": context,
    }


def print_reply(response: Dict[str, Any]) -> None:
    reply = response.get("reply") or {}
    text = reply.get("text") or ""
    reply_type = reply.get("type") or "text"
    route = response.get("route") or "NONE"
    tools = response.get("tool_calls") or []

    print()
    print(f"Bot [{route}/{reply_type}]: {text}")

    if reply.get("file_url"):
        print(f"  file_url: {reply.get('file_url')}")
    if reply.get("latitude") is not None and reply.get("longitude") is not None:
        print(f"  location: {reply.get('latitude')}, {reply.get('longitude')}")
    if tools:
        print(f"  tools: {', '.join(tools)}")
    if response.get("not_found_session"):
        print(f"  not_found_session: {response.get('not_found_session')}")
    print()


def print_help() -> None:
    print(
        """
Commands:
  /help                         Tampilkan bantuan
  /exit | /quit                 Keluar
  /reset                        Reset context percakapan lokal
  /user <id>                    Ganti channel_user_id dan session_key
  /session <key>                Ganti session_key saja
  /media <url> [mime] [name]    Kirim simulasi file/media

Ketik pesan biasa untuk chat.
""".strip()
    )


def main() -> int:
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(PROJECT_ROOT / "nanobot" / ".env")

    parser = argparse.ArgumentParser(description="Interactive Nanobot terminal chat")
    parser.add_argument("--url", default=os.getenv("NANOBOT_CHAT_URL") or f"http://127.0.0.1:{os.getenv('NANOBOT_PORT', '8766')}")
    parser.add_argument("--token", default=os.getenv("NANOBOT_SERVICE_TOKEN", ""))
    parser.add_argument("--user", default=os.getenv("NANOBOT_CHAT_USER", "terminal-user-001"))
    parser.add_argument("--name", default=os.getenv("NANOBOT_CHAT_NAME", "Tester Terminal"))
    parser.add_argument("--channel", default=os.getenv("NANOBOT_CHAT_CHANNEL", "terminal"))
    parser.add_argument("--timeout", type=int, default=int(os.getenv("NANOBOT_CHAT_TIMEOUT", "120")))
    args = parser.parse_args()

    if not args.token:
        print("ERROR: NANOBOT_SERVICE_TOKEN tidak ditemukan. Isi nanobot/.env atau pakai --token.", file=sys.stderr)
        return 1

    base_url = args.url.rstrip("/")
    endpoint = f"{base_url}/api/v1/turns"
    user_id = args.user
    session_key = f"{args.channel}:{user_id}"
    context: Optional[Dict[str, Any]] = None
    counter = 1

    print("Nanobot terminal chat")
    print(f"URL     : {endpoint}")
    print(f"User    : {user_id}")
    print(f"Session : {session_key}")
    print("Ketik /help untuk bantuan, /exit untuk keluar.")
    print()

    while True:
        try:
            user_text = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            return 0

        if not user_text:
            continue

        if user_text in {"/exit", "/quit"}:
            print("Bye.")
            return 0

        if user_text == "/help":
            print_help()
            continue

        if user_text == "/reset":
            context = None
            print("Context lokal di-reset.")
            continue

        if user_text.startswith("/user "):
            user_id = user_text.split(maxsplit=1)[1].strip()
            session_key = f"{args.channel}:{user_id}"
            context = None
            print(f"User diganti: {user_id}")
            print(f"Session diganti: {session_key}")
            continue

        if user_text.startswith("/session "):
            session_key = user_text.split(maxsplit=1)[1].strip()
            context = None
            print(f"Session diganti: {session_key}")
            continue

        media = None
        text_to_send = user_text
        if user_text.startswith("/media "):
            parts = user_text.split(maxsplit=3)
            if len(parts) < 2:
                print("Format: /media <url> [mimetype] [filename]")
                continue
            url = parts[1]
            mimetype = parts[2] if len(parts) >= 3 else "application/octet-stream"
            filename = parts[3] if len(parts) >= 4 else Path(url).name or "file"
            media = {"url": url, "mimetype": mimetype, "filename": filename}
            text_to_send = ""

        payload = build_payload(
            message_id=f"terminal-{counter}",
            channel=args.channel,
            user_id=user_id,
            text=text_to_send,
            sender_name=args.name,
            session_key=session_key,
            context=context,
            media=media,
        )
        counter += 1

        try:
            response = post_json(endpoint, args.token, payload, timeout=args.timeout)
        except Exception as error:
            print(f"ERROR: {error}")
            continue

        context = response.get("context") or context
        print_reply(response)


if __name__ == "__main__":
    raise SystemExit(main())
