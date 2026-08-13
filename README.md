# WhatsApp Bot Pemko Medan

Proyek ini adalah sistem backend layanan **WhatsApp Bot** yang dibangun menggunakan framework [NestJS](https://nestjs.com/) untuk Pemerintah Kota (Pemko) Medan. Bot ini terintegrasi dengan WhatsApp API, sistem webhook, serta module kecerdasan buatan (AI) berbasis LLM (Local/Self-hosted) untuk menjawab pertanyaan terkait layanan di kota Medan, termasuk informasi dari zona parkir.

## Arsitektur & Teknologi

*   **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
*   **Database**: MySQL dengan [Prisma ORM](https://www.prisma.io/)
*   **Job Queue & Caching**: Redis dan [BullMQ](https://docs.nestjs.com/techniques/queues)
*   **WhatsApp API**: Integrasi gateway khusus menggunakan Websocket dan modul gateway internal.
*   **AI Integration**: Terhubung dengan server Ollama/LLM untuk memproses *Natural Language Processing* dan sistem RAG (*Retrieval-Augmented Generation*).
*   **Containerization**: Docker & Docker Compose.

---

## Persiapan Instalasi (Prerequisites)

Pastikan Anda telah menginstal beberapa sistem berikut di lingkungan pengembangan/server:

1.  [Bun](https://bun.sh/) (sebagai *runtime* & *package manager*, rekomendasi versi 1.x)
2.  [Docker](https://www.docker.com/) dan [Docker Compose](https://docs.docker.com/compose/) (Opsional tapi sangat direkomendasikan untuk Redis & Database)
4.  MySQL (Jika tidak menggunakan Docker)
5.  Redis (Jika tidak menggunakan Docker)

---

## Konfigurasi *Environment Variables*

Buat file `.env` di *root* proyek (Anda bisa menyalin dari `.env.example` jika ada, atau mencontoh konfigurasi di bawah). Beberapa variabel krusial yang diperlukan:

```env
# Koneksi Database
# Prisma ORM String Connection
DATABASE_URL="mysql://root:password@localhost:3306/chatbot_pelayanan"
DATABASE_URL_ZONA_PARKIR="mysql://root:password@localhost:3306/zona_parkir"

# Konfigurasi Aplikasi & Bot
PORT=8000
BOT_SOCKET_URL=ws://localhost:3001
GATEWAY_SESSION=wagateway
SESSION_SECRET="rahasia_sesi_anda"
BOT_PLATFORM=wagateway # wagateway | telegram
TELEGRAM_BOT_TOKEN="TOKEN_DARI_BOTFATHER"
TELEGRAM_WEBHOOK_URL="https://domain-anda/telegram/webhook"

# Eksternal Gateway & API
WA_BOT_GATE_WAY="http://<IP_GATEWAY_WA>:<PORT>"
WA_BOT_WA_GATE_WAY_API_KEY="API_KEY_GATEWAY_ANDA"
WA_BOT_GATEWAY_SESSION=wabot
API_URL="https://wabot.medan.go.id/api-manajemen"

# Konfigurasi AI & RAG
AI_DEMO_BASE_URL="https://dekallm.cloudeka.ai/v1"
AI_DEMO_API_KEY="API_KEY_OPENAI_COMPATIBLE"
AI_DEMO_MODEL="meta/llama-4-maverick-instruct"
AI_GENERATOR="http://<IP_AI_SERVER>:<PORT>"
MODEL="gemma:2b"
TEMPERATURE=0.7
TOP_P=0.0
MAX_TOKEN=256
FREQUENCY_PENALTY=0.0
PRESENCE_PENALTY=0.0
PROMPT="Anda adalah asisten yang hanya menjawab berdasarkan informasi yang diberikan.\n\nINFORMASI:\n${response}\n\nPERTANYAAN:\n${question}\n\nJAWABAN:"
RAG_URL="http://<IP_RAG_SERVER>:<PORT>"

# Path Penyimpanan
FILE_FOLDER='/path/to/your/storage/folder'
```

---

## Instalasi & Setup

### 1. Install Dependencies

Gunakan `bun` untuk mengunduh semua *dependencies*:

```bash
bun install
```

### 2. Konfigurasi Database (Prisma)

Generate Prisma Client berdasarkan skema yang ada:

```bash
npx prisma generate
```

Jika database MySQL belum memiliki tabel yang diperlukan, Anda dapat melakukan sinkronisasi:

```bash
npx prisma db push
```
*(Catatan: karena proyek ini memiliki lebih dari satu koneksi database (Zona Parkir), pastikan konfigurasi modul prisma mengarah pada schema yang benar jika melakukan migrasi).*

---

## Menjalankan Aplikasi

Anda memiliki dua opsi untuk menjalankan aplikasi, yaitu secara lokal (langsung menggunakan Bun) atau melalui kontainer Docker.

### Opsi A: Menjalankan Secara Lokal (Development)

Pastikan Redis dan MySQL sudah berjalan.

```bash
# development
bun run start

# watch mode (Rekomendasi untuk dev)
bun run start:dev

# production mode
bun run start:prod
```

Jika memakai Telegram, set webhook bot sekali setelah backend memiliki URL publik:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<TELEGRAM_WEBHOOK_URL>"
```

### Opsi B: Menggunakan Docker Compose (Direkomendasikan)

Proyek ini telah dilengkapi dengan file `docker-compose.yml` untuk lingkungan *development* dan *production*.

Menjalankan environment *development*:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

Menjalankan environment *production*:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```
> **Catatan:** `docker-compose.yml` utama akan menjalankan kontainer aplikasi (`wa-bot-app`), MySQL, dan Redis secara bersamaan di dalam *network* bridge khusus.

---

## Struktur Proyek Utama

Beberapa modul penting di dalam folder `src/`:

- `app.module.ts`: Modul utama (Root) yang mengimpor seluruh modul fitur dan mengatur Redis (BullMQ), Logger, dan modul Throttler.
- `bot-webhook/`: Menangani rute dan *logic* untuk penerimaan *webhook* yang masuk dari provider WhatsApp Gateway.
- `whatsapp/`: Mengatur integrasi layanan dengan WhatsApp Gateway Eksternal.
- `telegram/`: Mengatur webhook inbound dan outbound Telegram Bot API.
- `channel/`: Facade pengalih pengiriman pesan berdasarkan `BOT_PLATFORM` (`wagateway` atau `telegram`).
- `ai/`: Logika komunikasi ke server LLM / Ollama dan sistem RAG.
- `zona-parkir-prisma/`: Modul khusus untuk melakukan query ke database `zona_parkir`.

---

## Testing

Untuk menjalankan unit test atau end-to-end (e2e) tests:

```bash
# unit tests
bun run test

# e2e tests
bun run test:e2e

# test coverage
bun run test:cov
```

---

## License

Proyek NestJS bersifat *open-source* (MIT), namun proyek spesifik milik instansi (Pemko Medan) dapat tunduk pada kebijakan kerahasiaan dan lisensi instansi terkait. Silakan hubungi tim *developer* internal untuk aturan penggunaan lebih lanjut.
