# DevOps Handoff: BBIK MOM Generator
**Status:** Ready for Deployment  
**Project:** BBIK MOM Generator (AI-Powered Meeting Minutes)        

---

## 1. Architecture Overview
The application is fully containerized using **Docker** and managed via **Docker Compose**. It consists of 5 interconnected services:

| Service | Technology | Role | Persistence |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js (Node 21) | User Interface (Client-side FFmpeg) | — |
| **Backend** | Express.js (Node 21) | RESTful API & Auth | — |
| **Worker** | Node.js (BullMQ) | Background AI Tasks (Transcription/Analysis) | — |
| **DB** | PostgreSQL 16 | Relational Storage (Users, Tasks, Results) | Docker Volume |
| **Redis** | Redis 7 | Task Queue Broker & Cache | Docker Volume |

---

## 2. Infrastructure Requirements

### 2.1 Computing Resources (Minimum)
*   **vCPU:** 2 Cores (Recommended: 4 Cores for concurrent AI processing)
*   **RAM:** 4 GB (Recommended: 8 GB due to BullMQ and FFmpeg processing)
*   **Disk:** 50 GB (SSD preferred) – largely for storing temporary audio uploads.

### 2.2 Networking & Port Mappings
| Service | External Port | Internal Port | Access Type |
| :--- | :---: | :---: | :--- |
| **Frontend** | 3000 | 3000 | Public (HTTPS recommended) |
| **Backend** | 3001 | 3001 | Public API (via `/api`) |
| **DB** | — | 5432 | Internal Only |
| **Redis** | — | 6379 | Internal Only |

> [!IMPORTANT]
> **Reverse Proxy Requirement:**  
> A reverse proxy (Nginx or Load Balancer) is **required** to handle SSL/TLS termination and route traffic. 
> - `/` -> Frontend (Port 3000)
> - `/api/` -> Backend (Port 3001)

---

## 3. Environment Variables & Secrets
DevOps must configure these in the production environment (e.g., via `.env` or CI/CD secrets).

### 3.1 Third-Party API Keys
| Key Name | Description | Source |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | API Key for Claude 3.5 Sonnet | Anthropic Console |
| `OPENAI_API_KEY` | API Key for Whisper Transcription | OpenAI Dashboard |

### 3.2 Application Secrets
| Key Name | Description | Security Level |
| :--- | :--- | :--- |
| `JWT_SECRET` | Signing key for Authentication tokens | High (Min 64 chars) |
| `DATABASE_URL` | `postgresql://user:password@db:5432/mom_generator` | High |
| `REDIS_HOST` | Set to `redis` (Internal Docker network) | Low |
| `REDIS_PORT` | `6379` | Low |

---

## 4. Crucial HTTP Response Headers (Security)
The application uses **FFmpeg.WASM** (SharedArrayBuffer) for high-performance audio compression. The following headers **MUST** be served by the web server (Nginx/Frontend) for the app to function:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## 5. Deployment Commands

### 5.1 Build and Deploy
```bash
# Command to build images and start services in detached mode
docker compose up --build -d
```

### 5.2 Initial Database Setup
The following command must be run **once** after the first deployment to initialize the database schema:
```bash
docker compose exec backend node src/config/database.js
```

### 5.3 Health Checks
Monitoring tools should target these endpoints:
*   **Backend:** `GET /health` -> Expected: `{"status":"ok"}`
*   **Frontend:** `GET /` -> Expected: `200 OK`

---

## 6. Persistence & Backup
1.  **PostgreSQL Data:** Mount `/var/lib/postgresql/data` to a persistent volume (e.g., EBS or local managed storage).
2.  **Redis Data:** Mount `/data` to a persistent volume.
3.  **Backups:** Routine dumps of the `mom_generator` database are highly recommended for production reliability.

---

## 7. CI/CD Pipeline Considerations
- **Frontend Build Arg:** The `frontend` service requires `NEXT_PUBLIC_API_URL` during the **Build Stage**.
- **Container Registry:** If deploying to highly restricted private clouds, images should be built, tagged, and pushed to a registry beforehand.
