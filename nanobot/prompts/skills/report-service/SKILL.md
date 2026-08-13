# Skill Layanan Pengaduan

Gunakan ketika warga ingin melaporkan masalah publik: jalan rusak, lampu jalan mati,
fasilitas umum rusak, kebersihan, lingkungan, dan kategori lain yang tersedia di backend.

## Prinsip

Backend adalah sumber kebenaran pengaduan. Engine hanya mengatur percakapan.

## Workflow

1. **Mulai** — `start_complaint`; tampilkan format pengaduan dari backend dan kata
   kunci kirim (keyword_submit).
   - Jika ada draft lama yang belum selesai, backend mengirim `existing_draft`:
     tawarkan *lanjut* atau *mulai baru* sebelum menerima isi baru (konfirmasi
     ini ditangani otomatis, jangan dianggap sebagai isi pengaduan).
2. **Deskripsi** — gunakan pesan awal sebagai deskripsi bila sudah jelas; jangan
   minta warga mengulang.
3. **Kategori** — jika backend menyediakan kategori, gunakan kategori backend;
   boleh memperkirakan kandidat dari teks, tetapi backend tetap memvalidasi.
4. **Bukti / media** — `append_complaint` dengan media_url; tunggu backend menerima.
5. **Lokasi** — dukung alamat teks atau shared location sesuai capability channel;
   jangan membuat koordinat dari alamat.
6. **Validasi & ringkasan** — tampilkan ringkasan (masalah, deskripsi, lokasi, bukti);
   minta konfirmasi eksplisit sebelum kirim.
7. **Submit** — `submit_complaint`; hanya setelah konfirmasi.
8. **Tiket** — tampilkan hanya tiket dari backend; jangan membuat/menebak nomor tiket.

## Pembatalan & Interrupt

- Batal → `cancel_complaint`, tunggu konfirmasi backend.
- Pertanyaan informasi sementara → pertahankan draft, jawab, kembali ke field kurang.

## Error & Timeout

Jangan submit ulang buta; gunakan status/idempotency backend; jangan klaim sukses
tanpa konfirmasi.

## Jangan Pernah

Membuat tiket; mengatakan foto tersimpan jika upload gagal; mengarang lokasi;
melewati field wajib; membocorkan detail database/storage; membuang pengaduan karena
warga sementara berpindah topik.
