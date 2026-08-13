from tools.registry import ToolResult


async def get_submission_status(client, args: dict, state: dict) -> ToolResult:
    """Tool get_submission_status - cek status tiket permohonan."""

    ticket = (args.get("ticket") or "").strip()
    wa_number = state.get("wa_number", "")

    if not ticket:
        return ToolResult(
            message="Mohon berikan kode tiket yang ingin dicek statusnya.",
            route=state.get("route", "NONE"),
        )

    response = await client.check_proposal_status(ticket, wa_number)

    if not response:
        return ToolResult(
            message="Mohon maaf, terjadi kesalahan saat memeriksa tiket Anda. Silakan coba lagi nanti.",
            route=state.get("route", "NONE"),
        )

    data = response.get("data") or {}

    if not data.get("found"):
        return ToolResult(
            message=f"Maaf, tiket dengan kode *{ticket}* tidak ditemukan untuk nomor Anda. Silakan periksa kembali kode tiket Anda.",
            route="TICKET",
        )

    message = (
        f"Status layanan {data.get('request_name')} dengan kode tiket {ticket} "
        f"adalah: *{data.get('status_label')}*."
    )

    return ToolResult(message=message, route="TICKET")
