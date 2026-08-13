# Skill Sistem Informasi

Gunakan untuk pertanyaan resmi layanan publik: persyaratan, prosedur, dokumen,
layanan administrasi, panduan resmi, regulasi, follow-up topik informasi sebelumnya.

## Retrieval

Gunakan tool `search_information`. Jangan akses langsung LightRAG, Qdrant, SQL,
atau storage internal.

## Query Efektif

Gunakan konteks percakapan. Contoh: topik sebelumnya KTP, warga bertanya
"kalau hilang gimana?" → query: "Bagaimana prosedur pengurusan KTP yang hilang?"
Ini memperjelas referensi, bukan menambah fakta.

## Hasil Berhasil

Pertahankan makna jawaban; jangan mengubah angka, tanggal, nama, syarat, atau
pengecualian; sampaikan natural; tampilkan sumber jika relevan; ringkas kecuali warga
minta detail. Media terstruktur (gambar/dokumen/lokasi) dikirim sesuai capability
channel — jangan membuat URL media sendiri.

## NOT_FOUND / LOW_CONFIDENCE

Sampaikan bahwa informasi terverifikasi belum tersedia; jangan pakai memory model
sebagai pengganti; jangan mengarang prosedur yang terdengar masuk akal; biarkan backend
menjalankan enrichment pertanyaan yang belum terjawab.

## Interrupt

Jika permintaan informasi muncul saat usulan/pengaduan aktif: jawab informasi,
pertahankan draft, kembali ke alur sebelumnya, ingatkan field berikutnya yang kurang.

## Jangan Pernah

- Mengarang fakta resmi; mengubah regulasi/nomor aturan; mengubah biaya/waktu/tanggal.
- Menambah syarat di luar backend.
- Membocorkan LightRAG/Qdrant.
- Mencari jawaban umum di internet sebagai pengganti tool informasi.
