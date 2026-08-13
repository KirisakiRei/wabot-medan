# Pemko Nanobot Engine

Conversation brain untuk WhatsApp Bot Pemko Medan — menggantikan lapisan
percakapan `bot-without-flow` (Gemini classifier + routing) dengan agent engine.
Referensi arsitektur: [HKUDS/nanobot](https://github.com/HKUDS/nanobot).

## Prinsip

```text
WhatsApp Gateway → Backend NestJS (webhook + BullMQ) → Nanobot Engine (/api/v1/turns)
       ↓ tool call (Bearer token)
Backend REST API v1 (information / proposals / status / preflight / log)
```

- **Nanobot** = conversation intelligence (routing, bahasa, sesi, interrupt).
- **Backend NestJS** = business brain (RAG, form, tiket, filter, log).
- Engine **tidak pernah** mengakses database/RAG langsung; semua lewat REST API.

## Struktur

```text
nanobot/
├── main.py               # FastAPI entrypoint (/api/v1/turns, /health, auth)
├── config.py             # Konfigurasi dari environment variable
├── models.py             # Kontrak request/response turn (Pydantic)
├── logging.py            # Logging console + file
├── agent/
│   ├── loop.py           # Orkestrasi turn: interrupt → LLM decision → tool → reply
│   └── llm.py            # Klien LLM OpenAI-compatible + parse JSON toleran
├── session/
│   └── store.py          # Sesi per user (wa:<phone>), persist JSON di workspace
├── tools/
│   ├── client.py         # PemkoAPIClient tunggal ke REST v1 backend
│   ├── information.py    # search_information
│   ├── proposals.py      # find/get/create/update/validate/submit/cancel proposal
│   ├── status.py         # get_submission_status
│   └── registry.py       # Daftar tool + deskripsi untuk prompt LLM
└── prompts/
    ├── SYSTEM.md         # Persona asisten Pemko Medan
    ├── ROUTING.md        # Aturan routing + format keputusan JSON
    └── SAFETY.md         # Batasan: jangan invent fakta/tiket/status
```

## Instalasi & Menjalankan

```bash
cd nanobot
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8765
# atau
python main.py
```

## Environment Variables

| Variable | Default | Fungsi |
|---|---|---|
| `NANOBOT_SERVICE_TOKEN` | `""` | Token Bearer yang sama dengan backend (guard `/api/v1/turns`) |
| `NANOBOT_BACKEND_URL` | `http://localhost:8001` | Base URL backend NestJS |
| `NANOBOT_BACKEND_API_KEY` | = token service | Token panggilan REST v1 backend |
| `NANOBOT_BACKEND_TIMEOUT` | `30` | Timeout (detik) ke backend |
| `NANOBOT_LLM_BASE_URL` | `http://localhost:11434/v1` | Base URL LLM OpenAI-compatible (Ollama/vLLM/Gemini OpenAI API) |
| `NANOBOT_LLM_API_KEY` | `nanobot` | API key LLM |
| `NANOBOT_LLM_MODEL` | `llama3.1` | Model LLM |
| `NANOBOT_LLM_TEMPERATURE` | `0.2` | Temperatur keputusan LLM |
| `NANOBOT_LLM_MAX_TOKENS` | `1024` | Maks token per panggilan |
| `NANOBOT_LLM_TIMEOUT` | `120` | Timeout (detik) LLM |
| `NANOBOT_PORT` | `8765` | Port HTTP engine |
| `NANOBOT_WORKSPACE` | `./workspace` | Folder sesi & log |
| `NANOBOT_HISTORY_LIMIT` | `20` | Batas riwayat percakapan per user |
| `NANOBOT_LOG_LEVEL` | `INFO` | Level logging |

## Kontrak Turn

```http
POST /api/v1/turns
Authorization: Bearer <NANOBOT_SERVICE_TOKEN>
```

Request & response mengikuti `models.py` (identik dengan
`src/bot-without-flow/nanobot/types/nanobot.types.ts` di backend).

## Alur Kerja Engine

1. Terima turn dari backend NestJS.
2. Muat sesi `wa:<phone>` (riwayat + state alur).
3. Cek interrupt deterministik ("batal"/"stop" saat form aktif → `cancel_proposal`).
4. Bila media masuk saat form aktif bertipe file → `update_proposal_field`.
5. LLM memutuskan: jawab langsung atau panggil tool (output JSON).
6. Tool dieksekusi → backend REST v1 → hasil jadi balasan.
7. Simpan sesi, kirim log turn ke backend, kembalikan `NanobotTurnResponse`.

## Catatan

- Sesi tersimpan di `workspace/sessions/*.json` (selamat dari restart).
- State alur (route/step/service) dikelola engine; data bisnis final tetap di
  backend (`request_histories`, `chat_logs`).
- Route `INFORMATION` saat proposal aktif dianggap interrupt sementara —
  state proposal tidak hilang.
