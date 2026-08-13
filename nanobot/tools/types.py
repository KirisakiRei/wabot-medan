from dataclasses import dataclass
from typing import Awaitable, Callable, Optional


@dataclass
class ToolResult:
    """Hasil eksekusi tool Pemko."""

    message: str
    route: str = "NONE"
    reply_type: str = "text"
    file_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    not_found: bool = False
    not_found_session: Optional[str] = None


ToolHandler = Callable[[object, dict, dict], Awaitable[ToolResult]]
