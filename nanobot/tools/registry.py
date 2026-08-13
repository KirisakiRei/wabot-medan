from typing import Dict

from tools import complaints, information, proposals, status
from tools.types import ToolHandler, ToolResult


TOOL_REGISTRY: Dict[str, dict] = {
    "search_information": {
        "description": (
            "Cari jawaban resmi seputar informasi layanan Pemko Medan "
            "(persyaratan, prosedur, lokasi, dll). Argument: {\"query\": \"pertanyaan\"}. "
            "Gunakan untuk semua pertanyaan informasi/fakta."
        ),
        "execute": information.search_information,
    },
    "find_proposal_service": {
        "description": (
            "Cari layanan publik (usulan) yang sesuai dengan permintaan pengguna. "
            "Argument: {\"request\": \"deskripsi layanan\"}."
        ),
        "execute": proposals.find_proposal_service,
    },
    "get_proposal_schema": {
        "description": (
            "Ambil daftar data yang perlu diisi untuk sebuah layanan. "
            "Argument: {\"request_id\": \"id layanan\"}."
        ),
        "execute": proposals.get_proposal_schema,
    },
    "create_proposal_draft": {
        "description": (
            "Mulai pengajuan layanan publik dan tampilkan pertanyaan form pertama. "
            "Argument: {\"request_id\": \"id layanan\"}. Panggil setelah pengguna setuju mengajukan layanan."
        ),
        "execute": proposals.create_proposal_draft,
    },
    "update_proposal_field": {
        "description": (
            "Simpan isian jawaban user untuk form yang sedang berjalan. "
            "Argument: {\"value\": \"jawaban user\"}. Jangan panggil tanpa form aktif."
        ),
        "execute": proposals.update_proposal_field,
    },
    "validate_proposal": {
        "description": (
            "Cek apakah semua data permohonan sudah lengkap sebelum dikirim. "
            "Tanpa argument. Panggil setelah semua form terisi."
        ),
        "execute": proposals.validate_proposal,
    },
    "submit_proposal": {
        "description": (
            "Kirim permohonan setelah user memberikan konfirmasi eksplisit. "
            "Tanpa argument. Backend yang membuat tiket."
        ),
        "execute": proposals.submit_proposal,
    },
    "cancel_proposal": {
        "description": (
            "Batalkan pengajuan/draft yang sedang berjalan. "
            "Tanpa argument. Panggil saat user membatalkan."
        ),
        "execute": proposals.cancel_proposal,
    },
    "get_submission_status": {
        "description": (
            "Cek status tiket permohonan yang sudah dikirim. "
            "Argument: {\"ticket\": \"kode tiket\"}."
        ),
        "execute": status.get_submission_status,
    },
    "start_complaint": {
        "description": (
            "Mulai pengaduan masyarakat dan tampilkan format pengaduan. "
            "Tanpa argument. Panggil saat user ingin melapor/mengadukan masalah publik."
        ),
        "execute": complaints.start_complaint,
    },
    "append_complaint": {
        "description": (
            "Simpan tambahan deskripsi atau bukti file pengaduan yang sedang berjalan. "
            "Argument: {\"text\": \"isi pengaduan\"} atau {\"media_url\": \"url file\"}. "
            "Jangan panggil tanpa pengaduan aktif."
        ),
        "execute": complaints.append_complaint,
    },
    "submit_complaint": {
        "description": (
            "Kirim pengaduan setelah user memberikan konfirmasi eksplisit. "
            "Tanpa argument. Backend yang membuat tiket."
        ),
        "execute": complaints.submit_complaint,
    },
    "cancel_complaint": {
        "description": (
            "Batalkan pengaduan/draft yang sedang berjalan. "
            "Tanpa argument. Panggil saat user membatalkan."
        ),
        "execute": complaints.cancel_complaint,
    },
    "check_complaint_status": {
        "description": (
            "Cek status tiket pengaduan yang sudah dikirim. "
            "Argument: {\"ticket\": \"kode tiket\"}."
        ),
        "execute": complaints.check_complaint_status,
    },
}


def tool_descriptions() -> str:
    """Daftar tool dalam format teks untuk prompt LLM."""

    lines = []
    for name, tool in TOOL_REGISTRY.items():
        lines.append(f"- {name}: {tool['description']}")

    return "\n".join(lines)
