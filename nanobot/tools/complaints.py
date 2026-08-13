from tools.types import ToolResult


async def start_complaint(client, args: dict, state: dict) -> ToolResult:
    """Tool start_complaint - mulai pengaduan dan tampilkan format pengaduan."""

    wa_number = state.get("wa_number", "")

    response = await client.create_complaint_draft(wa_number)

    if not response or not response.get("data", {}).get("success"):
        error_message = (response or {}).get("data", {}).get("message")
        return ToolResult(
            message=error_message or "Maaf, pengaduan belum dapat dimulai. Silakan coba lagi.",
            route=state.get("route", "NONE"),
        )

    data = response.get("data") or {}
    content = data.get("content") or ""
    keyword = data.get("keyword_submit") or ""

    state["route"] = "REPORT"
    state["step"] = 0
    state["ticket"] = data.get("ticket")
    state["complaint_keyword"] = keyword

    # Draft lama yang menggantung (misal dari sesi sebelumnya): tawarkan
    # lanjutkan atau mulai baru sebelum menerima isi baru.
    existing = data.get("existing_draft")
    if existing and (existing.get("complaint") or existing.get("attachments_count")):
        state["resume_waiting"] = True

        preview = existing.get("complaint") or ""
        if len(preview) > 120:
            preview = preview[:120] + "..."

        message = "Sebelumnya Anda sempat menulis pengaduan yang belum selesai:"
        if preview:
            message += f"\n\n*\"{preview}\"*"
        if existing.get("attachments_count"):
            message += f"\n(+{existing.get('attachments_count')} file lampiran)"
        message += "\n\nBalas *lanjut* untuk melanjutkan pengaduan tersebut, atau *mulai baru* untuk membuat pengaduan baru."

        return ToolResult(message=message, route="REPORT")

    state["resume_waiting"] = False

    message = f"Baik, mari kita buat pengaduan.\n\n{content}"
    if keyword:
        message += f"\n\nSetelah selesai, ketik *{keyword}* untuk mengirimkan pengaduan Anda."

    return ToolResult(message=message, route="REPORT")


async def append_complaint(client, args: dict, state: dict) -> ToolResult:
    """Tool append_complaint - simpan tambahan deskripsi/bukti pengaduan."""

    value = (args.get("text") or args.get("value") or "").strip()
    media_url = (args.get("media_url") or "").strip()
    media_caption = (args.get("media_caption") or "").strip() or None
    wa_number = state.get("wa_number", "")

    if state.get("route") != "REPORT":
        return ToolResult(
            message="Mohon maaf, tidak ada pengaduan yang sedang berjalan. Silakan mulai pengaduan terlebih dahulu.",
            route=state.get("route", "NONE"),
        )

    if not value and not media_url:
        return ToolResult(
            message="Mohon tuliskan isi pengaduan atau kirimkan file bukti.",
            route="REPORT",
        )

    response = await client.append_complaint_draft(
        wa_number,
        value or None,
        media_url or None,
        media_caption,
    )

    if not response or not response.get("data", {}).get("success"):
        error_message = (response or {}).get("data", {}).get("message")
        return ToolResult(
            message=error_message or "Mohon maaf, isi pengaduan tidak dapat disimpan. Silakan coba lagi.",
            route="REPORT",
        )

    keyword = state.get("complaint_keyword")
    message = "Baik, isi pengaduan Anda telah dicatat."
    if keyword:
        message += f" Ketik *{keyword}* untuk mengirimkan pengaduan, atau lanjutkan menambahkan deskripsi/bukti."

    return ToolResult(message=message, route="REPORT")


async def submit_complaint(client, args: dict, state: dict) -> ToolResult:
    """Tool submit_complaint - kirim pengaduan dan dapatkan tiket dari backend."""

    wa_number = state.get("wa_number", "")

    response = await client.submit_complaint_draft(wa_number)

    if not response or not response.get("data", {}).get("success"):
        error_message = (response or {}).get("data", {}).get("message")
        return ToolResult(
            message=error_message or "Mohon maaf, pengaduan gagal dikirim. Silakan coba lagi.",
            route="REPORT",
        )

    data = response.get("data") or {}
    ticket = data.get("ticket")

    state["route"] = "NONE"
    state["step"] = 0
    state["ticket"] = ticket
    state["complaint_keyword"] = None

    return ToolResult(
        message=f"Terima kasih! Pengaduan Anda telah kami terima dengan kode tiket *{ticket}*.",
        route="NONE",
    )


async def cancel_complaint(client, args: dict, state: dict) -> ToolResult:
    """Tool cancel_complaint - batalkan draft pengaduan yang sedang berjalan."""

    wa_number = state.get("wa_number", "")

    await client.cancel_complaint_draft(wa_number)

    state["route"] = "NONE"
    state["step"] = 0
    state["ticket"] = None
    state["complaint_keyword"] = None

    return ToolResult(
        message="Baik, pengaduan dibatalkan. Ada lagi yang bisa saya bantu?",
        route="NONE",
    )


async def check_complaint_status(client, args: dict, state: dict) -> ToolResult:
    """Tool check_complaint_status - cek status tiket pengaduan."""

    ticket = (args.get("ticket") or "").strip()
    wa_number = state.get("wa_number", "")

    if not ticket:
        return ToolResult(
            message="Mohon berikan kode tiket yang ingin dicek statusnya.",
            route=state.get("route", "NONE"),
        )

    response = await client.check_complaint_status(ticket, wa_number)

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
        f"Status pengaduan Anda dengan kode tiket {ticket} "
        f"adalah: *{data.get('status_label')}*."
    )

    return ToolResult(message=message, route="TICKET")
