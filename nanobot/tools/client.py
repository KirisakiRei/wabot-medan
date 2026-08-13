import logging
from typing import Optional

import httpx

logger = logging.getLogger("nanobot.client")


class PemkoAPIClient:
    """Klien HTTP tunggal ke backend NestJS (Business Brain).

    Seluruh tool memakai client ini, tidak ada HTTP call tersebar (mengikuti
    prinsip satu API client pada PRD).
    """

    def __init__(self, config):
        self.base_url = config.backend_url
        self.timeout = config.backend_timeout

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config.backend_token}",
                "X-Internal-Request": "true",
            },
        )

    async def close(self):
        await self.client.aclose()

    async def post(self, path: str, payload: dict) -> Optional[dict]:
        try:
            response = await self.client.post(path, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as error:
            logger.error("Error POST %s: %s", path, error)
            return None

    async def get(self, path: str) -> Optional[dict]:
        try:
            response = await self.client.get(path)
            response.raise_for_status()
            return response.json()
        except Exception as error:
            logger.error("Error GET %s: %s", path, error)
            return None

    async def patch(self, path: str, payload: dict) -> Optional[dict]:
        try:
            response = await self.client.patch(path, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as error:
            logger.error("Error PATCH %s: %s", path, error)
            return None

    # ========================================================================
    # INTEGRATION
    # ========================================================================
    async def preflight(self, channel_user_id: str, text: str) -> Optional[dict]:
        return await self.post(
            "/api/v1/integration/chat/preflight",
            {"channel": "whatsapp", "channel_user_id": channel_user_id, "text": text},
        )

    async def log_turn(
        self,
        channel_user_id: str,
        user_message: str,
        bot_reply: str,
        route: str,
        tool_calls: list,
    ) -> None:
        await self.post(
            "/api/v1/integration/chat/log",
            {
                "channel": "whatsapp",
                "channel_user_id": channel_user_id,
                "user_message": user_message,
                "bot_reply": bot_reply,
                "route": route,
                "tool_calls": tool_calls,
            },
        )

    # ========================================================================
    # INFORMATION
    # ========================================================================
    async def search_information(self, query: str, wa_number: str) -> Optional[dict]:
        return await self.post(
            "/api/v1/information/search",
            {"query": query, "wa_number": wa_number, "channel": "whatsapp"},
        )

    # ========================================================================
    # PROPOSAL
    # ========================================================================
    async def search_proposal_services(self, query: str, wa_number: str) -> Optional[dict]:
        return await self.post(
            "/api/v1/proposals/services/search",
            {"query": query, "wa_number": wa_number},
        )

    async def get_proposal_schema(self, request_id: str) -> Optional[dict]:
        return await self.get(f"/api/v1/proposals/services/{request_id}/schema")

    async def create_proposal_draft(self, wa_number: str, request_id: str) -> Optional[dict]:
        return await self.post(
            "/api/v1/proposals/drafts",
            {"wa_number": wa_number, "request_id": request_id},
        )

    async def update_proposal_field(self, wa_number: str, form_id: str, value: str) -> Optional[dict]:
        return await self.patch(
            f"/api/v1/proposals/drafts/{wa_number}/fields/{form_id}",
            {"value": value},
        )

    async def validate_proposal_draft(self, wa_number: str) -> Optional[dict]:
        return await self.post(f"/api/v1/proposals/drafts/{wa_number}/validate", {})

    async def submit_proposal_draft(self, wa_number: str) -> Optional[dict]:
        return await self.post(f"/api/v1/proposals/drafts/{wa_number}/submit", {})

    async def cancel_proposal_draft(self, wa_number: str) -> Optional[dict]:
        return await self.post(f"/api/v1/proposals/drafts/{wa_number}/cancel", {})

    async def check_proposal_status(self, ticket: str, wa_number: str) -> Optional[dict]:
        return await self.post(
            "/api/v1/proposals/status",
            {"ticket": ticket, "wa_number": wa_number},
        )
