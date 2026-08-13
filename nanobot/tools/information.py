from tools.registry import ToolResult


async def search_information(client, args: dict, state: dict) -> ToolResult:
    """Tool search_information - pencarian jawaban FAQ via RAG backend."""

    query = (args.get("query") or "").strip()
    wa_number = state.get("wa_number", "")

    if not query:
        return ToolResult(
            message="Mohon beri tahu pertanyaan yang ingin Anda tanyakan.",
            route=state.get("route", "NONE"),
        )

    response = await client.search_information(query, wa_number)

    if not response:
        return ToolResult(
            message="Mohon maaf, informasi sedang tidak dapat diakses. Silakan coba lagi nanti.",
            route=state.get("route", "NONE"),
        )

    data = response.get("data") or {}
    status = data.get("status", "ERROR")
    answer = data.get("answer") or {}
    text = answer.get("text") or "Mohon maaf saya belum bisa menjawab pertanyaanmu."

    attachments = answer.get("attachments") or []
    location = answer.get("location")

    reply_type = "text"
    file_url = None
    latitude = None
    longitude = None

    if attachments:
        reply_type = attachments[0].get("type") or "document"
        file_url = attachments[0].get("url")

    if location:
        reply_type = "location"
        latitude = location.get("latitude")
        longitude = location.get("longitude")

    found = status == "ANSWERED"

    # Route informasi hanya dipakai bila tidak sedang di tengah alur lain.
    # Jika sedang mengisi proposal, ini dianggap interrupt sementara.
    current_route = state.get("route", "NONE")
    route = "INFORMATION" if current_route in ("NONE", "INFORMATION", "ASSISTANT") else current_route

    return ToolResult(
        message=text,
        reply_type=reply_type,
        file_url=file_url,
        latitude=latitude,
        longitude=longitude,
        route=route,
        not_found=not found,
        not_found_session="sistem-informasi" if not found else None,
    )
