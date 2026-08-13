from tools.registry import ToolResult


async def find_proposal_service(client, args: dict, state: dict) -> ToolResult:
    """Tool find_proposal_service - cari layanan publik yang sesuai permintaan."""

    request_text = (args.get("request") or "").strip()
    wa_number = state.get("wa_number", "")

    if not request_text:
        return ToolResult(
            message="Mohon tuliskan layanan apa yang ingin Anda ajukan.",
            route=state.get("route", "NONE"),
        )

    response = await client.search_proposal_services(request_text, wa_number)

    if not response or not response.get("data", {}).get("success"):
        return ToolResult(
            message="Maaf, saat ini saya tidak dapat menemukan layanan yang sesuai dengan permintaan Anda.",
            route=state.get("route", "NONE"),
            not_found=True,
            not_found_session="layanan-publik",
        )

    data = response.get("data") or {}
    matches = data.get("matches") or []

    if not matches:
        return ToolResult(
            message="Maaf, saat ini saya tidak dapat menemukan layanan yang sesuai dengan permintaan Anda.",
            route=state.get("route", "NONE"),
            not_found=True,
            not_found_session="layanan-publik",
        )

    match = matches[0]
    message = (
        f"Saya menemukan layanan *{match.get('request_name')}* yang sesuai "
        "dengan permintaan Anda. Apakah Anda ingin mengajukan layanan ini?"
    )

    return ToolResult(message=message, route=state.get("route", "NONE"))


async def get_proposal_schema(client, args: dict, state: dict) -> ToolResult:
    """Tool get_proposal_schema - tampilkan data yang perlu diisi layanan."""

    request_id = (args.get("request_id") or "").strip()

    if not request_id:
        return ToolResult(
            message="Mohon sertakan identitas layanan yang ingin dilihat skemanya.",
            route=state.get("route", "NONE"),
        )

    response = await client.get_proposal_schema(request_id)

    if not response or not response.get("data", {}).get("success"):
        return ToolResult(
            message="Maaf, skema layanan tidak ditemukan.",
            route=state.get("route", "NONE"),
        )

    data = response.get("data") or {}
    forms = data.get("forms") or []
    form_list = "\n".join(f"{index + 1}. {form.get('form')}" for index, form in enumerate(forms))

    return ToolResult(
        message=f"Data yang perlu dilengkapi untuk layanan *{data.get('request_name')}*:\n{form_list}",
        route=state.get("route", "NONE"),
    )


async def create_proposal_draft(client, args: dict, state: dict) -> ToolResult:
    """Tool create_proposal_draft - mulai pengisian form permohonan."""

    request_id = (args.get("request_id") or "").strip()
    wa_number = state.get("wa_number", "")

    if not request_id:
        return ToolResult(
            message="Mohon sertakan layanan yang ingin diajukan.",
            route=state.get("route", "NONE"),
        )

    response = await client.create_proposal_draft(wa_number, request_id)

    if not response or not response.get("data", {}).get("success"):
        return ToolResult(
            message="Maaf, saat ini saya tidak dapat menemukan formulir untuk layanan yang Anda minta.",
            route=state.get("route", "NONE"),
        )

    data = response.get("data") or {}
    forms = data.get("forms") or []

    state["route"] = "PROPOSAL"
    state["step"] = 0
    state["service"] = {
        "request_id": request_id,
        "request_name": data.get("request_name") or "Layanan",
    }
    state["forms"] = forms
    state["pending_form_id"] = forms[0].get("id") if forms else None
    state["ticket"] = data.get("token")

    return ToolResult(
        message=data.get("message") or data.get("next_form") or "Silakan isi data layanan.",
        route="PROPOSAL",
    )


async def update_proposal_field(client, args: dict, state: dict) -> ToolResult:
    """Tool update_proposal_field - simpan isian form yang sedang berjalan."""

    value = (args.get("value") or "").strip()
    wa_number = state.get("wa_number", "")
    form_id = state.get("pending_form_id")

    if state.get("route") != "PROPOSAL" or not form_id:
        return ToolResult(
            message="Mohon maaf, tidak ada form yang sedang berjalan. Silakan mulai pengajuan layanan terlebih dahulu.",
            route=state.get("route", "NONE"),
        )

    if not value:
        return ToolResult(
            message="Mohon isi data yang diminta pada form ini.",
            route="PROPOSAL",
        )

    response = await client.update_proposal_field(wa_number, form_id, value)

    if not response or not response.get("data", {}).get("success"):
        error_message = (response or {}).get("data", {}).get("message")
        return ToolResult(
            message=error_message or "Mohon maaf, isian tidak dapat disimpan. Silakan coba lagi.",
            route="PROPOSAL",
        )

    data = response.get("data") or {}

    if data.get("done"):
        state["step"] = len(state.get("forms") or [])
        state["pending_form_id"] = None
        return ToolResult(
            message="Semua data layanan telah terisi. Silakan konfirmasi untuk mengirimkan permohonan Anda.",
            route="PROPOSAL",
        )

    next_step = state.get("step", 0) + 1
    state["step"] = next_step

    forms = state.get("forms") or []
    state["pending_form_id"] = forms[next_step].get("id") if next_step < len(forms) else None

    return ToolResult(
        message=data.get("next_form") or "Silakan lanjutkan mengisi data berikutnya.",
        route="PROPOSAL",
    )


async def validate_proposal(client, args: dict, state: dict) -> ToolResult:
    """Tool validate_proposal - cek kelengkapan data draft."""

    wa_number = state.get("wa_number", "")

    response = await client.validate_proposal_draft(wa_number)

    if not response:
        return ToolResult(
            message="Mohon maaf, validasi gagal. Silakan coba lagi.",
            route=state.get("route", "NONE"),
        )

    data = response.get("data") or {}

    if data.get("valid"):
        return ToolResult(
            message="Semua data sudah lengkap. Silakan kirim permohonan Anda.",
            route="PROPOSAL",
        )

    missing_fields = data.get("missing_fields") or []
    missing_list = "\n".join(f"- {field.get('form')}" for field in missing_fields)

    return ToolResult(
        message=f"Masih ada data yang belum diisi:\n{missing_list}",
        route="PROPOSAL",
    )


async def submit_proposal(client, args: dict, state: dict) -> ToolResult:
    """Tool submit_proposal - kirim permohonan dan dapatkan tiket dari backend."""

    wa_number = state.get("wa_number", "")

    response = await client.submit_proposal_draft(wa_number)

    if not response or not response.get("data", {}).get("success"):
        error_message = (response or {}).get("data", {}).get("message")
        return ToolResult(
            message=error_message or "Mohon maaf, permohonan gagal dikirim. Silakan coba lagi.",
            route="PROPOSAL",
        )

    data = response.get("data") or {}
    ticket = data.get("ticket")

    state["route"] = "NONE"
    state["step"] = 0
    state["service"] = None
    state["forms"] = []
    state["pending_form_id"] = None
    state["ticket"] = ticket

    return ToolResult(
        message=f"Terima kasih! Permohonan Anda telah kami terima dengan kode tiket *{ticket}*.",
        route="NONE",
    )


async def cancel_proposal(client, args: dict, state: dict) -> ToolResult:
    """Tool cancel_proposal - batalkan draft permohonan yang sedang berjalan."""

    wa_number = state.get("wa_number", "")

    await client.cancel_proposal_draft(wa_number)

    state["route"] = "NONE"
    state["step"] = 0
    state["service"] = None
    state["forms"] = []
    state["pending_form_id"] = None
    state["ticket"] = None

    return ToolResult(
        message="Baik, pengajuan layanan dibatalkan. Ada lagi yang bisa saya bantu?",
        route="NONE",
    )
