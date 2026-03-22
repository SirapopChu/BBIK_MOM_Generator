# Backend (BBIK MOM Generator)

This backend provides APIs for:
1. **Transcribing audio** using **OpenAI Whisper** (via OpenAI API).
2. **Generating meeting minutes** from transcripts using **Anthropic Claude**.
3. **Exporting minutes as DOCX** with a predefined bilingual (Thai/English) template.
4. **Task management** for long-running workflows (transcribe → analyze → export).

---

## ✅ Quick Start

### 1) Install dependencies

```bash
cd Backend
npm install
```

### 2) Create a `.env` file

Copy the provided `.env` (if exists) or create one with at least:

```env
ANTHROPIC_API_KEY=<your_claude_api_key>
OPENAI_API_KEY=<your_openai_api_key>  # optional, required for /api/transcribe
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
LOGO_PATH=./assets/Bluebik_Logo_2025_Horizontal_Primary_Logo_Black.png
```

### 3) Run the server

```bash
npm run dev
```

By default the server will run at: `http://localhost:3001`

---

## 🧠 Environment Variables

| Name | Required | Description |
|------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude AI API key (used for generating meeting minutes) |
| `OPENAI_API_KEY` | ⚠️ optional | OpenAI key for Whisper transcription (required for `/api/transcribe` endpoints) |
| `PORT` | ❌ | Server port (default: 3001) |
| `NODE_ENV` | ❌ | Node environment (default: `development`) |
| `ALLOWED_ORIGINS` | ❌ | Comma-separated list of allowed origins for CORS (default: `http://localhost:3000`) |
| `LOGO_PATH` | ❌ | Path to logo used in generated DOCX headers |

---

## 🔌 API Endpoints

### Health

`GET /health`

Response:
```json
{ "status": "ok", "env": "development", "ts": "..." }
```

### Transcription (Whisper)

`POST /api/transcribe`

Accepts `multipart/form-data` with:
- `audio` (file): audio file (`mp3`, `wav`, `webm`, `m4a`, ...)
- `language` (string, optional): BCP-47 language code (e.g. `th`, `en`). If omitted, Whisper auto-detects.

Example (curl):

```bash
curl -X POST http://localhost:3001/api/transcribe \
	-F "audio=@./my-audio.mp3" \
	-F "language=th"
```

Response:
```json
{
	"text": "...",
	"language": "th",
	"duration": 123.45,
	"segments": [ { "id": 0, "start": 0.0, "end": 3.0, "text": "..." } ]
}
```

> ⚠️ Whisper has a maximum upload size of ~25 MB, so keep audio files under that.

### Generate Meeting Minutes (text)

`POST /api/minutes/generate`

Accepts `multipart/form-data` with either:
- `transcript` (file): `.txt` file, or
- `text` (string): raw transcript text.

Example:

```bash
curl -X POST http://localhost:3001/api/minutes/generate \
	-F "text=@transcript.txt"
```

Response:
```json
{
	"result": "... generated minutes ...",
	"usage": { /* Claude API usage info */ }
}
```

### Export DOCX

`POST /api/minutes/export-docx`

Accepts `multipart/form-data` with:
- `transcript` (file) or `text` (string)
- `filename` (optional) to name the output DOCX (without extension)
- `metadata` (optional JSON string) for overriding some values (meeting title, date, participants, etc.)

Returns a `.docx` file download.

Example:

```bash
curl -X POST http://localhost:3001/api/minutes/export-docx \
	-F "text=...transcript text..." \
	-F "filename=team_meeting"
```

### Full Workflow (Transcribe → Analyze → Export)

`POST /api/minutes/process-audio`

Uploads audio to be transcribed, sent to Claude for minutes, and converted to DOCX.

Request (multipart/form-data):
- `audio` (file)
- `language` (optional)

Response:
```json
{ "taskId": "TASK-..." }
```

Then poll status or download result:

```bash
curl http://localhost:3001/api/tasks/<taskId>
curl http://localhost:3001/api/tasks/<taskId>/download
```

### Task Management

`GET /api/tasks` — list all tasks

`GET /api/tasks/:id` — get task status

`GET /api/tasks/:id/logs` — get logs for a task

`GET /api/tasks/:id/download` — download the DOCX result (when ready)

`POST /api/tasks/:id/cancel` — cancel a running task

`DELETE /api/tasks/:id` — delete a task

`DELETE /api/tasks` — clear completed tasks history

---

## 🧩 Notes

- This backend uses an **in-memory task store** (`src/services/task.service.js`). Tasks are not persisted across restarts.
- The DOCX generator uses an internal template and expects Claude output to follow a specific structure.
- If you need higher throughput or persistence, replace the in-memory task store with a database (e.g., Redis/Postgres).

---

## 🛠️ Development

Run the server with auto-reload:

```bash
npm run dev
```

Run the Whisper test helper:

```bash
node test-whisper.js ./path/to/audio.mp3 th
```

Compress a large audio file (before sending to Whisper):

```bash
node compress-audio.js ./voiceonly.MP3 32k
```

---

## 👀 Helpful Files

- `src/index.js` — main Express server entrypoint
- `src/config/index.js` — environment config + validation
- `src/routes/transcribe.routes.js` — Whisper transcription endpoint
- `src/routes/minutes.routes.js` — meeting minutes + DOCX export
- `src/routes/tasks.routes.js` — task workflow endpoints
- `src/services/llm.service.js` — Anthropic Claude prompts & API calls
- `src/services/docx.service.js` — DOCX generation logic
- `src/services/transcription.service.js` — OpenAI Whisper helper
- `src/services/task.service.js` — in-memory task tracking

---

🙏 If you have questions about changing the prompt structure (template) or adding new output formats, start with `src/services/llm.service.js` and `src/services/docx.service.js`.

