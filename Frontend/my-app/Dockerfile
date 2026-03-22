# syntax=docker/dockerfile:1

# ───────────────────────────────────────────────────────────────────────────────
# Stage 1 – install all deps (including devDeps needed for build)
# ───────────────────────────────────────────────────────────────────────────────
FROM node:21-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ───────────────────────────────────────────────────────────────────────────────
# Stage 2 – build Next.js application
# ───────────────────────────────────────────────────────────────────────────────
FROM node:21-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Passed at build time: docker build --build-arg NEXT_PUBLIC_API_URL=...
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ───────────────────────────────────────────────────────────────────────────────
# Stage 3 – minimal runtime
# ───────────────────────────────────────────────────────────────────────────────
FROM node:21-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only ship the production server files
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static      ./.next/static
COPY --from=builder /app/public            ./public

EXPOSE 3000

USER node

CMD ["node", "server.js"]
