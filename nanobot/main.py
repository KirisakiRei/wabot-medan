import logging
from typing import Optional

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException

from agent.loop import AgentLoop
from agent.llm import LLMClient
from config import config
from log import setup_logging
from models import NanobotTurnRequest, NanobotTurnResponse
from session.store import SessionStore
from tools.client import PemkoAPIClient
from tools.registry import TOOL_REGISTRY

setup_logging()
logger = logging.getLogger("nanobot.main")


async def verify_service_token(
    authorization: Optional[str] = Header(default=None),
) -> None:
    """Guard autentikasi Bearer token untuk integrasi service-to-service."""

    expected_token = config.service_token

    if expected_token and authorization == f"Bearer {expected_token}":
        return

    raise HTTPException(status_code=401, detail="Unauthorized")


def build_app() -> FastAPI:
    app = FastAPI(title="Pemko Nanobot Engine", version="1.0.0")

    # ------------------------------------------------------------------------
    # Singleton runtime: session, LLM, client backend, dan registry tools
    # ------------------------------------------------------------------------
    session_store = SessionStore(config)
    llm_client = LLMClient(config)
    pemko_client = PemkoAPIClient(config)
    agent_loop = AgentLoop(
        config=config,
        session_store=session_store,
        llm_client=llm_client,
        pemko_client=pemko_client,
        tool_registry=TOOL_REGISTRY,
    )

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "runtime": "alive",
            "model": config.llm_model,
            "backend": config.backend_url,
        }

    @app.post("/api/v1/turns", response_model=NanobotTurnResponse)
    async def handle_turn(
        request: NanobotTurnRequest,
        _: None = Depends(verify_service_token),
    ) -> NanobotTurnResponse:
        logger.info(
            "Turn masuk session_key=%s text=%s",
            request.session_key,
            request.text[:100],
        )

        return await agent_loop.handle_turn(request)

    return app


app = build_app()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=config.port,
        reload=False,
    )
