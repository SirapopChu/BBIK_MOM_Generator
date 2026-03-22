# Project Roadmap: BBIK MOM Generator

**Project Status:** Production Ready (v1.2.0)
**Primary Architecture Documentation:**
- [Architecture: Backend](./ARCHITECTURE_BE.md)
- [Architecture: Frontend](./ARCHITECTURE_FE.md)
- [API Specification](./API_SPEC.md)
- [CI/CD Configuration](./CICD.md)

---

## [COMPLETED] Phase 0: Foundations
- [x] Backend Service Patterns (Repository, Factory, Builder, Strategy)
- [x] Frontend Hook Extraction (Recorder, Compression, Transcription)
- [x] Dockerization (Multi-stage builds, Compose deployment)
- [x] Technical Specification & Basic Documentation

## [COMPLETED] Phase 1: Integration & Cleanup
- [x] Unified API Facade in Frontend (`api.ts`)
- [x] WaveSurfer.js Integration (Visualisation)
- [x] FFmpeg WASM (Client-side compression)

## [COMPLETED] Phase 2: Persistence (Data Layer)
- [x] PostgreSQL Integration (Multitenant-ready schema)
- [x] TaskRepository Refactor for PostgreSQL
- [x] Persistent volume for processed documents

## [COMPLETED] Phase 3: Scalability (Background Workers)
- [x] Redis + BullMQ Task Queue
- [x] Decoupled Worker Process (`worker.js`)
- [x] Real-time Progress Logging

## [COMPLETED] Phase 4: UX & Internationalization
- [x] 100% Thai/English Parity (i18n Dictionaries)
- [x] Settings Page (Model & Language Configuration)
- [x] Playwright E2E Smoke Tests

## [COMPLETED] Phase 5: Enterprise Security (Auth)
- [x] JWT-based Authentication (Backend & Frontend)
- [x] User-scoped Data Isolation (Database & Workers)
- [x] Premium Login/Register Interface (Glassmorphism)

---

## Phase 6: Advanced Intelligence (Future) ไว้ค่อยทำ ยังไม่ต้อง
- [ ] **Speaker Diarization:** Implement speaker identification using audio timestamps.
- [ ] **Template Customization:** Enable users to upload their own Word templates.
- [ ] **RBAC:** Add Admin/Reviewer/User role-based access controls.
- [ ] **Extended Transcription:** Implement chunked processing for meetings > 2 hours.
