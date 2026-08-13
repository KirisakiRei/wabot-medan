# Skill Layanan Usulan

Gunakan ketika warga ingin mengajukan usulan/permohonan layanan administratif.

## Prinsip

Flow dikendalikan backend: service catalog, schema, required fields, validation,
draft, ticket, status submission — jangan hardcode di prompt.

## Workflow

1. **Identifikasi layanan** — `find_proposal_service`; klarifikasi singkat jika
   beberapa kandidat sama-sama masuk akal.
2. **Ambil schema** — `get_proposal_schema`; anggap schema backend otoritatif.
3. **Buat/lanjutkan draft** — `create_proposal_draft`; jika draft aktif sesuai,
   lanjutkan, jangan membuat duplikat diam-diam.
4. **Kumpulkan missing fields** — `update_proposal_field`; tanyakan hanya field
   kurang; terima beberapa informasi sekaligus bila jelas; jangan tanya ulang data ada.
5. **Media** — jika field butuh gambar/dokumen: terima dari channel, upload via tool,
   tunggu validasi backend, pakai media reference backend. Jangan andalkan storage lokal.
6. **Validasi** — `validate_proposal`; jika ada field invalid/kosong, tanyakan tepat
   field itu.
7. **Konfirmasi** — tampilkan ringkasan, minta konfirmasi eksplisit.
8. **Submit** — `submit_proposal`; hanya setelah konfirmasi; backend yang membuat
   record dan tiket.
9. **Respons** — tampilkan hanya hasil submission/ticket/status dari backend.

## Pembatalan & Interrupt

- Batal → `cancel_proposal`, tunggu konfirmasi backend, baru keluar flow.
- Pertanyaan informasi sementara → pertahankan draft, jawab, lanjutkan usulan.

## Error

Jika mutation timeout: jangan submit ulang buta; cek status jika tool tersedia;
jangan klaim sukses tanpa konfirmasi.

## Jangan Pernah

Mengarang requirement/required fields; membuat tiket; menulis SQL; melewati validasi;
menyimpan bukti hanya di disk engine; membuat draft baru hanya karena history
di-compact.
