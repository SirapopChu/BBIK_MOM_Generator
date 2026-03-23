# Architecture: Backend — BBIK MOM Generator

**Primary Framework:** Node.js 21 + Express 4 (ESM)
**Persistence:** PostgreSQL 16
**Scalability:** Redis + BullMQ

---

## 1. Database Schema (PostgreSQL)
The application uses a multi-tenant-ready schema with the following tables:

- **`users`**: Stores authenticated user credentials (Bcrypt-hashed passwords).
- **`tasks`**: Tracks status (processing, completed, failed), metadata, and a foreign key to `users`.
- **`task_logs`**: Stores real-time progress messages for user-level feedback.
- **`task_results`**: Stores the final processed DOCX binary buffer.

Refer to `Backend/src/config/database.js` for migration logic.

---

## 2. Background Processing (BullMQ)
Long-running AI tasks (Whisper transcription & Claude analysis) are offloaded to background workers.

- **Queue Service:** `Backend/src/services/queue.service.js` handles job instantiation.
- **Worker Process:** `Backend/src/worker.js` listens for 'audio-pipeline' jobs and propagates the `userId` to the service layer.
- **Pipeline Logic:** `Backend/src/services/pipeline.service.js` orchestrates the multi-step AI workflow.

---

## 3. Service Layer (Design Patterns)
- **Repository Pattern:** `TaskRepository.js` abstracts PostgreSQL queries.
- **Strategy Pattern:** `llm.service.js` uses providers (Anthropic) for generative AI tasks.
- **Factory Pattern:** `docx.service.js` builds complex Word documents with dynamic data.

---

## 4. Key Services
- **`transcription.service.js`**: OpenAI Whisper API integration with chunking support.
- **`llm.service.js`**: Anthropic Claude integration for bilingual minute generation.
- **`docx.service.js`**: Generates BBIK-branded Word documents with dynamic tables.

---

## 5. Security Model
- **JWT Middleware:** `src/middleware/auth.middleware.js` verifies Bearer tokens.
- **Query Scoping:** All task and result queries include a mandatory `user_id = $1` filter to ensure 100% data isolation.

---

