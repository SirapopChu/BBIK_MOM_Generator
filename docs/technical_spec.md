# Technical Specification — BBIK Meeting Minutes (MOM) Generator

**Version:** 1.1.0  
**Date:** 2026-03-22  
**Classification:** Internal Engineering

---

## 1. Executive Summary

The BBIK MOM Generator is a two-tier web application that automates the production of bilingual (Thai/English) meeting minutes. Audio captured from live microphone input or uploaded files is transcribed via OpenAI Whisper and then structured into a DOCX document by Anthropic Claude. The system targets PMO analysts who need to reduce post-meeting documentation time.

---

## 2. Architecture Overview

```
Browser (Next.js 16)
       |
       | HTTPS / HTTP (REST)
       v
Express 4 API (Node 21)
       |
       +---> OpenAI Whisper API   (transcription)
       |
       +---> Anthropic Claude API (minute generation)
       |
       +---> docx library         (DOCX assembly, local)
```

### Component Boundaries

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript | UI, media capture, task polling |
| Backend API | Node 21 + Express 4 (ESM) | Request handling, orchestration |
| Transcription | OpenAI Whisper (whisper-1 / large-v2) | Speech-to-text |
| Minute Generation | Anthropic Claude (configurable model) | Structured bilingual minutes |
| Document Assembly | `docx` npm, served as Buffer | DOCX binary generation |
| Task Tracking | In-memory (TaskRepository) | Async job state, logs |

---

## 3. Design Patterns Applied

### 3.1 Backend

| Pattern | Location | Rationale |
|---|---|---|
| Repository | `Backend/src/services/task.service.js` — `TaskRepository` class | Encapsulates in-memory state; trivially swappable with Redis/RDBMS |
| Factory | `Backend/src/services/docx.service.js` — `DocxElementFactory` object | Centralises DOCX primitive construction; eliminates 4 duplicated helper functions |
| Builder | `Backend/src/services/docx.service.js` — `DiscussionSectionBuilder` class | Manages stateful line-by-line assembly of the discussion table; extracts a complex closure |
| Strategy | `Backend/src/services/llm.service.js` — `AnthropicProvider` object | LLM provider is referenced via a strategy object; swap by reassigning `provider` |
| Factory Method (Middleware) | `Backend/src/middleware/upload.js` — `createUpload(limitMB)` | Parameterised multer instance factory; eliminates duplication across routes |

### 3.2 Frontend

| Pattern | Location | Rationale |
|---|---|---|
| Facade | `frontend/my-app/services/api.ts` | Single access point for all backend HTTP calls; components never call `fetch()` directly |
| Custom Hook (SRP) | `frontend/my-app/hooks/useAudioRecorder.ts` | Isolates WaveSurfer, RecordPlugin, device enumeration, volume metering |
| Custom Hook (SRP) | `frontend/my-app/hooks/useCompressedUpload.ts` | FFmpeg WASM lifecycle with lazy-init to prevent SSR error |
| Custom Hook (SRP) | `frontend/my-app/hooks/useTranscription.ts` | Whisper upload state and error handling |

---

## 4. Data Flow

### 4.1 Live Recording -> DOCX

```
[useAudioRecorder]
  Browser MediaRecorder / RecordPlugin (WaveSurfer)
      |  Blob (webm/mp4)
      v
[useCompressedUpload]
  FFmpeg WASM (if > 22 MB) -> 32 kbps mono MP3
      |  Blob (mp3 or original)
      v
POST /api/minutes/process-audio
      |  Returns { taskId }
      v
[Background: runAudioPipeline]
  [1] transcribeAudio()  -> OpenAI Whisper -> TranscriptResult
  [2] generateMinutesText() -> Claude -> structured text
  [3] buildDocxBuffer() -> DiscussionSectionBuilder -> Buffer
  [4] taskService.update(taskId, { status: 'completed' }, buffer)
      |
      v
GET /api/tasks/:id/download -> sends Buffer as .docx attachment
```

### 4.2 Upload Transcript -> DOCX

```
POST /api/minutes/export-docx (text body)
  [1] generateMinutesText() -> Claude
  [2] buildDocxBuffer() -> Buffer
  [3] HTTP response: Content-Disposition attachment (.docx)
```

---

## 5. API Contract

### 5.1 Transcription

```
POST /api/transcribe
Content-Type: multipart/form-data
Fields: audio (file), language (string, optional)

200 { text, language, duration, segments: [{ id, start, end, text }] }
400 { error }
500 { error }
```

### 5.2 Audio Pipeline (Async)

```
POST /api/minutes/process-audio
Content-Type: multipart/form-data
Fields: audio (file), language (string), metadata (JSON string, optional)

202 { taskId }

GET /api/tasks/:id
200 { task: { id, status, progress, currentStep, error, completedAt } }

GET /api/tasks/:id/download
200 application/vnd.openxmlformats-officedocument.wordprocessingml.document

POST /api/tasks/:id/cancel
200 { success: true }
```

---

## 6. Performance Characteristics

| Concern | Mechanism |
|---|---|
| Large audio files (>22 MB) | Client-side FFmpeg WASM compression to 32 kbps mono MP3 |
| OpenAI 25 MB API limit | Pre-check in `Backend/src/services/transcription.service.js` with descriptive error |
| Long LLM latency (10-60s) | Fire-and-forget background pipeline; client polls task status |
| In-memory task cap | MAX_HISTORY=50 with FIFO eviction; MAX_LOGS=100 per task |
| SSR FFmpeg crash | Lazy instantiation inside `frontend/my-app/hooks/useCompressedUpload.ts`; no module-level allocation |
| Docker image size | Multi-stage builds: `--omit=dev` in backend, `standalone` output in frontend |

---

## 7. Security Considerations

- API keys are loaded exclusively from environment variables; never committed.
- CORS restricted to `ALLOWED_ORIGINS` env var (default: `http://localhost:3000`).
- File size hard-capped at 50 MB (multer) and 25 MB (Whisper pre-check).
- Docker runtime uses the non-root `node` user.
- `LOGO_PATH` is resolved with `path.resolve(process.cwd(), ...)` — no user-supplied path traversal possible.

---

## 8. Known Limitations

1. **In-memory task store** — all task history is lost on process restart. Production requires Redis or a relational store.
2. **Single-process concurrency** — multiple simultaneous audio pipelines share the Node.js event loop. A task queue (e.g., BullMQ) is required for sustained load.
3. **Claude token ceiling** — `max_tokens: 6000` may truncate minutes for very long meetings (>2-3 hours). Increase or implement chunking.
4. **System audio on macOS** — `getDisplayMedia` with audio requires the user to tick "Share audio" in the browser dialog; this is a browser constraint that cannot be programmatically enforced.
