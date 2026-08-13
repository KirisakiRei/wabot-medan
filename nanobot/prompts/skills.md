# SKILLS — Peta Skill Pemko

File ini adalah manifest untuk manusia dan ringkasan muatan skill runtime.
Aturan operasional lengkap berada di `skills/<nama-skill>/SKILL.md` dan `ROUTING.md`,
dimuat otomatis sesuai route aktif.

## Daftar Skill

| Skill | Route aktif | Isi |
|---|---|---|
| conversation-routing | selalu | Aturan routing & prioritas — lihat `ROUTING.md` |
| information-service | INFORMATION | Pencarian info resmi, grounding, NOT_FOUND |
| proposal-service | PROPOSAL | Alur usulan: schema, draft, media, validasi, submit |
| report-service | REPORT | Alur pengaduan: deskripsi, bukti, lokasi, submit, tiket |

## Tool yang Dikuasai

1. **Informasi** — `search_information`: pertanyaan fakta/syarat/prosedur/lokasi/biaya.
2. **Usulan** — `find_proposal_service`, `get_proposal_schema`, `create_proposal_draft`,
   `update_proposal_field`, `validate_proposal`, `submit_proposal`, `cancel_proposal`.
3. **Pengaduan** — `start_complaint`, `append_complaint`, `submit_complaint`,
   `cancel_complaint`, `check_complaint_status`.
4. **Status** — `get_submission_status` (usulan), `check_complaint_status` (pengaduan).

## Panduan Pemilihan Skill

- Pertanyaan informasi → information-service + `search_information`.
- Niat mengajukan layanan → proposal-service + rangkaian tool usulan.
- Niat melapor/mengadukan masalah → report-service + rangkaian tool pengaduan.
- Cek tiket/status → tool status yang sesuai.
- Sapaan/terima kasih/klarifikasi → jawab langsung, jangan panggil tool.
