# CI/CD Configuration: BBIK MOM Generator

This document outlines the Continuous Integration and Continuous Deployment (CI/CD) strategy for the BBIK MOM Generator platform.

---

## 1. Overview
The project uses GitHub Actions for automated testing, building, and deployment verification. The pipeline ensures that every pull request and push to the main branch maintains the system's high reliability and architectural integrity.

---

## 2. Continuous Integration (CI)

### 2.1 Backend Pipeline
- **Unit Tests:** Executes `npm run test` (Vitest) to verify repository logic, service patterns, and AI pipeline orchestration.
- **Docker Build:** Validates the multi-stage `Backend/Dockerfile` to ensure production assets are correctly built.
- **Dependency Audit:** Checks for security vulnerabilities in dependencies.

### 2.2 Frontend Pipeline
- **Linting:** Executes `npm run lint` (ESLint) to maintain code quality and adherence to Next.js standards.
- **Build Verification:** Executes `npm run build` to ensure the Next.js application compiles successfully with the `standalone` output configuration.
- **E2E Testing:** Executes `npx playwright test` to verify critical dashboard flows, authentication, and language switching.

---

## 3. GitHub Actions Workflow (Example)

Create a file at `.github/workflows/ci.yml`:

```yaml
name: Project Verification

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: user
          POSTGRES_PASSWORD: password
          POSTGRES_DB: mom_generator
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 21
          cache: 'npm'
          cache-dependency-path: Backend/package-lock.json

      - name: Install Dependencies
        run: cd Backend && npm ci

      - name: Run Backend Tests
        run: cd Backend && npm run test
        env:
          DATABASE_URL: postgres://user:password@localhost:5432/mom_generator
          REDIS_URL: redis://localhost:6379

  frontend-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 21
          cache: 'npm'
          cache-dependency-path: frontend/my-app/package-lock.json

      - name: Install Dependencies
        run: cd frontend/my-app && npm ci

      - name: Lint
        run: cd frontend/my-app && npm run lint

      - name: Build
        run: cd frontend/my-app && npm run build

      - name: Install Playwright Browsers
        run: cd frontend/my-app && npx playwright install --with-deps

      - name: Run E2E Tests
        run: cd frontend/my-app && npx playwright test
```

---

## 4. Continuous Deployment (CD)

### 4.1 Container Registry
Production-ready images for `frontend` and `backend` should be pushed to a container registry (e.g., Docker Hub, AWS ECR, or GitHub Container Registry) upon successful merge to the `main` branch.

### 4.2 Automated Deployment
The deployment job should trigger a pull of the latest images on the production server (e.g., via `docker compose pull` followed by `docker compose up -d`).

---

## 5. Required Secrets (GitHub Actions)
To enable the full pipeline, the following secrets must be configured in your GitHub repository:

- `ANTHROPIC_API_KEY`: Required for LLM integration tests.
- `OPENAI_API_KEY`: Required for transcription service verification.
- `JWT_SECRET`: Required for authentication middleware testing.
- `DATABASE_URL`: Production connection string (for deployment jobs).
- `DOCKER_HUB_USERNAME` / `DOCKER_HUB_TOKEN`: For registry authentication.
