# Deployment Guide: BBIK MOM Generator
**Version:** 1.2.x  
**Last Updated:** 2026-03-26  
**Prepared by:** Kunanan Wongsing

---

## 1. Overview

BBIK MOM Generator is deployed as a **multi-container Docker application** managed by `docker-compose.yml`. The stack consists of five services:

| Service    | Image / Build         | Port | Description                         |
|------------|-----------------------|------|-------------------------------------|
| `db`       | `postgres:16-alpine`  | —    | Primary database (PostgreSQL)       |
| `redis`    | `redis:7-alpine`      | —    | Queue broker for BullMQ             |
| `backend`  | Build from `Backend/` | 3001 | Express API server                  |
| `worker`   | Build from `Backend/` | —    | Background AI processing worker     |
| `frontend` | Build from `Frontend/`| 3000 | Next.js web application             |

---

## 2. Prerequisites

Ensure the following tools are installed on the target server before deployment:

| Tool           | Version Required | Check Command         |
|----------------|------------------|-----------------------|
| Docker         | ≥ 24.x           | `docker --version`    |
| Docker Compose | ≥ 2.x (plugin)   | `docker compose version` |
| Git            | Any              | `git --version`       |

> **Note:** Docker Desktop bundles Docker Compose as a plugin on macOS/Windows. On Linux servers, install the `docker-compose-plugin` package separately.

---

## 3. Environment Configuration

### 3.1 Clone the Repository
```bash
git clone https://github.com/SirapopChu/BBIK_MOM_Generator.git
cd BBIK_MOM_Generator
```

### 3.2 Configure Backend Environment
Copy the example file and fill in the required secrets:
```bash
cp Backend/.env.example Backend/.env
```

Edit `Backend/.env` with the correct values:

```env
# ── Required ──────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=<your_anthropic_api_key>
OPENAI_API_KEY=<your_openai_api_key>
JWT_SECRET=<a_long_random_secret_string>

# ── AI Model Configuration ────────────────────────────────────────────────────
ANTHROPIC_MODEL=claude-sonnet-4-5     # Recommended production model

# ── Server ────────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production

# ── CORS (comma-separated list of allowed frontend origins) ───────────────────
ALLOWED_ORIGINS=https://your-domain.com

# ── Assets ────────────────────────────────────────────────────────────────────
LOGO_PATH=./assets/Bluebik_Logo_2025_Horizontal_Primary_Logo_Black.png

# ── Injected automatically by docker-compose.yml ─────────────────────────────
# DATABASE_URL=postgresql://user:password@db:5432/mom_generator
# REDIS_HOST=redis
# REDIS_PORT=6379
```

> ⚠️ **Never commit `Backend/.env` to Git.** It is listed in `.gitignore`.

---

## 4. Deploying with Docker Compose

### 4.1 Build and Start All Services
```bash
docker compose up --build -d
```
This command will:
1. Pull `postgres:16-alpine` and `redis:7-alpine` images.
2. Build the `backend`/`worker` image from `Backend/Dockerfile`.
3. Build the `frontend` image from `Frontend/my-app/Dockerfile`.
4. Start all five services in detached mode (`-d`).

### 4.2 Verify All Services Are Running
```bash
docker compose ps
```

Expected output — all services should show `running (healthy)` or `running`:

```
NAME                SERVICE     STATUS          PORTS
bbik-backend-1      backend     running (healthy)   0.0.0.0:3001->3001/tcp
bbik-db-1           db          running (healthy)
bbik-frontend-1     frontend    running             0.0.0.0:3000->3000/tcp
bbik-redis-1        redis       running (healthy)
bbik-worker-1       worker      running
```

### 4.3 Check Backend Health
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok"}`

---

## 5. Database Initialisation

On the first run, the PostgreSQL database is empty. Run the migration script to create the required tables:

```bash
# Execute migration inside the running backend container
docker compose exec backend node src/config/database.js
```

> The migration script creates the `users`, `tasks`, `task_logs`, and `task_results` tables automatically.

---

## 6. Updating to a New Version

```bash
# Pull the latest code
git pull origin main

# Rebuild images and restart services with zero-downtime strategy
docker compose up --build -d
```

Docker Compose will rebuild only changed services and perform a rolling restart.

---

## 7. Viewing Logs

```bash
# All services (live tail)
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend
```

---

## 8. Stopping and Removing Services

```bash
# Stop all services (preserves volumes)
docker compose down

# Stop and remove volumes (⚠️ DELETES all data)
docker compose down -v
```

---

## 9. Production Security Checklist

Before going live, verify the following:

- [ ] `Backend/.env` uses a strong, unique `JWT_SECRET` (min 64 chars).
- [ ] `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are valid and have sufficient quota.
- [ ] `ALLOWED_ORIGINS` is restricted to the production frontend URL only.
- [ ] PostgreSQL and Redis ports are **not** exposed to the public internet (no `ports:` entry in `docker-compose.yml` for `db` and `redis`).
- [ ] HTTPS/TLS is terminated at a reverse proxy (Nginx, Caddy, or a cloud load balancer) in front of the application.
- [ ] The server running Docker is protected by a firewall exposing only ports `80`, `443`, and `22` (SSH).
- [ ] Docker daemon is running as non-root and the backend container runs as the built-in `node` user.

---

## 10. Reverse Proxy (Nginx Example)

For production traffic, place Nginx in front of both services:

```nginx
# /etc/nginx/sites-available/bbik-mom

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
    }

    # Backend API
    location /api/ {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        # Required for FFmpeg WASM SharedArrayBuffer support
        add_header Cross-Origin-Opener-Policy same-origin;
        add_header Cross-Origin-Embedder-Policy require-corp;
    }
}
```

---

## 11. Required HTTP Headers (FFmpeg WASM)

The frontend uses **FFmpeg.WASM** for client-side audio compression, which requires `SharedArrayBuffer`. The following HTTP response headers **must** be present on all frontend responses in production:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Set these at the Nginx / load balancer level or in `Frontend/my-app/next.config.ts`.

---

## 12. Rollback Procedure

If a new deployment causes issues:

```bash
# Identify the previous working image tag
docker images | grep bbik

# Roll back to a specific image (if tagged)
docker compose down
# Edit docker-compose.yml to pin the image tag, then:
docker compose up -d
```

For Git-level rollback:
```bash
git revert HEAD
git push origin main
# Then re-run: docker compose up --build -d
```

---

*Document maintained by the BBIK MOM Generator team.*
