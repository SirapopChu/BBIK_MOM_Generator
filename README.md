# BBIK MOM Generator

**AI-Powered Professional Meeting Minutes Platform**

The BBIK MOM Generator is an enterprise-grade solution for automating the capture, transcription, and summarization of professional meetings. It leverages advanced Generative AI (Anthropic Claude & OpenAI Whisper) to produce structured, bilingual (Thai/English) meeting minutes formatted as professional DOCX documents.

---

## 1. Key Features

- **Dual-Source Recording (System + Mic):** High-fidelity capture of both browser audio (Teams/Zoom) and the user's local microphone.
- **Dynamic Device Support:** Seamlessly switch microphones during an active recording session without interruption.
- **Modern Typography:** Optimized for Thai/English readability using **Noto Sans Thai** and **Prompt** Google Fonts.
- **Client-Side Compression:** FFmpeg WASM integration to compress audio before upload, ensuring high performance for long meetings.
- **Bilingual Intelligence:** 100% Thai/English parity for both the UI and the generated AI summaries.
- **Enterprise Security:** JWT-based authentication with strict data isolation for multi-tenant occupancy.
- **Scalable Processing:** Redis-backed BullMQ task queue for asynchronous, high-reliability background processing.
- **Automated Formatting:** Dynamic generation of BBIK-branded DOCX files with structured discussion tables and action items.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4 (CSS-first config) |
| **Fonts** | Noto Sans Thai, Prompt (Next/Font) |
| **Backend API** | Node.js 21, Express 4 (ESM), JWT Auth |
| **Database** | PostgreSQL 16 (Relational Persistence) |
| **Worker Queue** | Redis 7, BullMQ (Asynchronous Tasks) |
| **AI (Transcription)** | OpenAI Whisper (Large-v3/v2) |
| **AI (Analysis)**| Anthropic Claude 3.5 Sonnet / Opus |
| **Infrastructure** | Docker, Docker Compose (Multi-stage builds) |

---

## 3. Documentation

For detailed technical guides and architectural deep-dives, please refer to the `docs/` folder:

- **[Master Handoff Guide](./docs/HANDOVER_SPEC.md)**: Entry point for new developers.
- **[Deployment Guide](./docs/DEPLOYMENT.md)**: Step-by-step production setup and Docker instructions.
- **[Improvement Roadmap](./docs/IMPROVEMENT.md)**: Feedback logs and planned prompt optimizations for Q2/2026.
- **[Architecture: Backend](./docs/ARCHITECTURE_BE.md)**: Database schema, AI pipeline, and API Specifications.
- **[Architecture: Frontend](./docs/ARCHITECTURE_FE.md)**: Next.js structure, i18n system, and media processing.
- **[CI/CD Strategy](./docs/CICD.md)**: Automation workflows and testing infrastructure.

---

## 4. Getting Started

### Prerequisites
- Node.js 21+
- Docker Desktop
- API Keys: Anthropic (Claude) and OpenAI (Whisper)

### Quick Start (Docker)
The easiest way to run the entire stack is using Docker Compose:

```bash
# 1. Clone the repository
git clone https://github.com/SirapopChu/BBIK_MOM_Generator.git
cd BBIK_MOM_Generator

# 2. Configure variables (Backend)
cp Backend/.env.example Backend/.env
# Fill in ANTHROPIC_API_KEY, OPENAI_API_KEY, and DATABASE_URL

# 3. Launch the platform
docker compose up --build
```
The application will be available at:
- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:3001`

---

## 5. Development Roles

| Role | Responsibility |
|---|---|
| **PMO Analysts** | Initiate meetings, capture audio, and approve AI-generated minutes. |
| **System Admins**| Manage user roles and monitor processing queues. |
| **Developers** | Maintain AI prompts, document templates, and system scalability. |

---

## 6. License & Compliance
This software is internal property of BBIK Technology. Unauthorized distribution or reproduction is strictly prohibited.
