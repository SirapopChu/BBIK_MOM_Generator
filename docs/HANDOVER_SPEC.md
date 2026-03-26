# Handover Specification: BBIK MOM Generator
**Status:** Production Ready (v1.2.x)  
**Last Update:** 2026-03-26  

## 1. Project Overview
BBIK MOM Generator is an enterprise-grade AI platform designed to capture and summarize professional meetings. It features a bilingual (Thai/English) interface and produces MOM in structured DOCX formats.

---

## 2. Core Architecture & Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript.
- **Styling:** Tailwind CSS v4 (Modern CSS-first architecture).
- **Fonts:** Noto Sans Thai (Primary Thai) + Prompt (Clean English/Thai).
- **Backend:** Node.js 21, Express (ESM), PostgreSQL 16, Redis 7.
- **Queue System:** BullMQ (Backed by Redis) for async AI processing.
- **Infrastructure:** Dockerized with `docker-compose.yml` defining `backend`, `frontend`, `worker`, `db`, and `redis`.

---

## 3. Critical Technical Modules (The "Brains")

### 3.1 Dual-Source Audio Capture (`frontend/hooks/useAudioRecorder.ts`)
- **How it works:** Uses `AudioContext` to mix two streams into a single `MediaStreamAudioDestinationNode`.
    - **Stream A:** User's Microphone (`getUserMedia`).
    - **Stream B:** System/Browser Audio (`getDisplayMedia`).
- **Dynamic Switching:** Implemented "hot-swapping" logic. When a user changes the microphone input *during* a recording, the `AudioContext` disconnects the old source node and connects a new one without stopping the `MediaRecorder`.
- **Security Gotcha:** `getDisplayMedia` **MUST** be triggered directly by a user synchronous click event. Any async delay between the click and the API call will cause a browser security block.

### 3.2 Client-Side Compression (`frontend/hooks/useCompressedUpload.ts`)
- Uses **FFmpeg.WASM** to compress `.webm` or `.wav` streams into `.mp3` before uploading.
- This drastically reduces upload time and server bandwidth consumption for meetings lasting 1+ hours.

### 3.3 The Worker Pipeline (`Backend/src/services/pipeline.service.js`)
- **Step 1:** OpenAI Whisper (Large-v3) transcription.
- **Step 2:** Anthropic Claude (3.5 Sonnet) analysis for summarization and action items.
- **Step 3:** DOCX Generation using `Backend/src/services/docx.service.js` (BBIK Branded Template).

---

## 4. UI & Design System (Tailwind v4)
- **Typography:** The app uses **Noto Sans Thai** (Primary Thai) and **Prompt** (Secondary). Set globally in `app/layout.tsx` and `app/globals.css`.
- **Warning:** IDEs might flag `@theme` in `globals.css` as "Unknown at rule". This is expected in Tailwind v4 and should be ignored; it works fine in the build process.
- **Palette:** BBIK Blue (`#3b7bed`) and Slate Dark.

---

## 5. Development Maintenance

### 5.1 Adding New AI Models
Update `Backend/src/services/llm.service.js` or `Backend/.env` to point to newer Anthropic/OpenAI models. The system is designed to be model-agnostic.

### 5.2 Modifying the Word Template
The DOCX logic is in `Backend/src/services/docx.service.js`. It uses `docx` (library) to build the document programmatically. Future developers may want to replace this with an actual `.docx` template-filling library (like `docxtemplater`) if the design becomes too complex.

### 5.3 Database Management
- Use `Backend/src/config/database.js` for migration logic.
- Ensure `DATABASE_URL` in `.env` matches the Postgres container credentials.

---

## 6. Known "Gotchas" & Next Steps
- **Screen Share Audio:** On MacOS/Chrome, the "Share System Audio" checkbox must be manually checked by the user in the browser popup.
- **FFmpeg WASM:** Requires `SharedArrayBuffer` support; ensure headers (`Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy`) are correctly set in production.
- **Future Task (Phase 7):** **Speaker Diarization**. Whisper currently returns a single block of text. Integration with `pyannote` or another diarization service will be required to distinguish between multiple speakers.
- **Privacy Design:** The system does **NOT** store raw audio files on disk or in the database. Audio data exists only in-memory (Redis) during the background processing job and is deleted immediately upon completion.

## 7. Operational Documentation

For day-to-day operations and future planning, refer to these documents:
- **[Deployment Guide](./DEPLOYMENT.md)**: Steps to setup production environments and Docker maintenance.
- **[Improvement Roadmap](./IMPROVEMENT.md)**: Quality feedback logs and prompt optimization plans for April 2026.

---

