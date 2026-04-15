# ============================================================
# King of Claws — Production Dockerfile
# Multi-stage build: build frontend → run server + serve static
# ============================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency install
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

RUN npm install

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/client packages/client

# Build shared types
RUN npm run build -w packages/shared 2>/dev/null || true

# Build frontend (produces packages/client/dist)
# Increase Node.js memory limit for Railway's limited resources
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build -w packages/client

# ---- Stage 2: Run ----
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install production dependencies only
RUN npm install --omit=dev 2>/dev/null || npm install

# Copy shared source (needed at runtime for type imports with tsx)
COPY packages/shared packages/shared

# Copy server source
COPY packages/server packages/server

# Copy built frontend
COPY --from=builder /app/packages/client/dist packages/client/dist

# Install tsx for running TypeScript directly
RUN npm install -g tsx

# Default environment
ENV PORT=3001
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3001

# Serve: Node server + static frontend
CMD ["tsx", "packages/server/src/index.ts"]
