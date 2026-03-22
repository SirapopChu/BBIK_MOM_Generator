# API Specification — BBIK MOM Generator

**Base URL:** `http://localhost:3001`
**Authentication:** Bearer Token (JWT) in `Authorization` header.

---

## 1. Authentication Endpoints

### POST /api/auth/register
- **Payload:** `{ email, password, name }`
- **Response:** `{ user, token }`

### POST /api/auth/login
- **Payload:** `{ email, password }`
- **Response:** `{ user, token }`

---

## 2. Task Management (Protected)

### GET /api/tasks
- **Description:** Lists tasks for the authenticated user.
- **Response:** `{ tasks: [{ id, status, title, ... }] }`

### GET /api/tasks/:id
- **Description:** Get specific task status and progress.
- **Response:** `{ task: { id, progress, status, logs } }`

### GET /api/tasks/:id/download
- **Description:** Download the generated DOCX binary.
- **Response:** `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (attachment)

---

## 3. Minute Generation Pipeline (Protected)

### POST /api/minutes/process-audio
- **Format:** `multipart/form-data`
- **Fields:** `audio` (blob), `language` (string), `metadata` (JSON), `model` (optional).
- **Description:** Initialises async transcription and minute generation. Returns `taskId`.

### POST /api/minutes/export-docx
- **Format:** `application/json` or `multipart/form-data`
- **Description:** Direct text-to-DOCX conversion. Returns binary buffer.

---

## 4. Direct Transcription (Protected)

### POST /api/transcribe
- **Format:** `multipart/form-data`
- **Fields:** `audio` (blob), `language` (string).
- **Description:** Returns transcription text and segment timestamps.

---

## 5. Security & Isolation
- Every request to `/api/tasks`, `/api/minutes`, and `/api/transcribe` **must** include a valid Bearer token.
- Failure to provide a token or an invalid token result in a `401 Unauthorized` response.
- All database operations are scoped by the `user_id` extracted from the JWT payload.
