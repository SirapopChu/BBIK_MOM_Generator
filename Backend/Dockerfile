# syntax=docker/dockerfile:1

# ───────────────────────────────────────────────────────────────────────────────
# Stage 1 – install production dependencies only
# ───────────────────────────────────────────────────────────────────────────────
FROM node:21-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# Omit devDependencies from production install
RUN npm ci --omit=dev

# ───────────────────────────────────────────────────────────────────────────────
# Stage 2 – runtime image (minimal attack surface)
# ───────────────────────────────────────────────────────────────────────────────
FROM node:21-alpine AS runtime

WORKDIR /app

# Copy only what is needed at runtime
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY assets/ ./assets/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run as non-root user (node user is built into the base image)
USER node

CMD ["node", "src/index.js"]
