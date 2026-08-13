from typing import List, Optional

from pydantic import BaseModel, Field


class NanobotMedia(BaseModel):
    url: str
    mimetype: Optional[str] = None
    filename: Optional[str] = None


class NanobotService(BaseModel):
    request_id: str
    request_name: str


class NanobotTurnContext(BaseModel):
    active_route: str = "NONE"
    current_step: int = 0
    last_response: str = ""
    request_id: Optional[str] = None
    service: Optional[NanobotService] = None


class NanobotTurnRequest(BaseModel):
    message_id: Optional[str] = None
    channel: str = "whatsapp"
    channel_user_id: str
    text: str
    media: Optional[NanobotMedia] = None
    sender_name: str = ""
    message_time: str = ""
    session_key: str
    context: Optional[NanobotTurnContext] = None


class NanobotReply(BaseModel):
    type: str = "text"
    text: str = ""
    file_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class NanobotTurnResponse(BaseModel):
    route: str = "NONE"
    reply: NanobotReply = Field(default_factory=NanobotReply)
    tool_calls: List[str] = []
    not_found: bool = False
    not_found_session: Optional[str] = None
    context: NanobotTurnContext = Field(default_factory=NanobotTurnContext)
