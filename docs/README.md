# Developer Handoff: Master Guide — BBIK MOM Generator

**Status:** Production Ready (v1.2.0)
**Last Updated:** 2026-03-22
**Priority:** Enterprise Security & Bilingual Support

---

## 1. Introduction
The BBIK MOM Generator is a professional-grade meeting productivity tool designed for PMO teams. It automates the transcription, analysis, and document generation process for meetings in both Thai and English.

## 2. Documentation Suite
For a successful continuation of the project, please refer to the following specialized documents:

- **[Architecture: Backend](./ARCHITECTURE_BE.md)**: Details on Node.js, PostgreSQL, Redis, BullMQ, and the AI Service layer.
- **[Architecture: Frontend](./ARCHITECTURE_FE.md)**: Details on Next.js, AuthContext, i18n, and client-side media processing.
- **[API Specification](./API_SPEC.md)**: Endpoint definitions, request/response formats, and authentication headers.
- **[CI/CD Configuration](./CICD.md)**: GitHub Actions workflow, unit testing, and deployment strategies.
- **[Task Roadmap](./task.md)**: Immediate next steps and future features.

---

## 3. Quick Start

### Prerequisites
- Node.js 21+
- Docker & Docker Compose
- API Keys: Anthropic (Claude), OpenAI (Whisper)

### Local Setup
```bash
# Clone the repository
git clone https://github.com/SirapopChu/BBIK_MOM_Generator.git
cd BBIK_MOM_Generator

# Start the full stack (Recommended)
docker compose up --build
```

### Direct Development
- **Backend:** `cd Backend && npm run dev` (Port 3001)
- **Frontend:** `cd frontend/my-app && npm run dev` (Port 3000)

---

## 4. Security & Compliance
The system implements JWT-based authentication with strict data isolation at the database level. Every task and document is scoped to a specific `user_id`.

## 5. Contact & Support
For architectural questions, refer to the **[Technical Specification](file:///Users/khempz/.gemini/antigravity/brain/721904e5-f7c5-4be8-b94d-17b2abf264cf/technical_spec.md)** which contains the original design patterns and rationale.
