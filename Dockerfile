# ──────────────────────────────────────────────
# Stage 1: Base with pnpm
# ──────────────────────────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ──────────────────────────────────────────────
# Stage 2: Production dependencies only
# ──────────────────────────────────────────────
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --ignore-scripts

# ──────────────────────────────────────────────
# Stage 3: Build (all deps + compile)
# ──────────────────────────────────────────────
FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

# ──────────────────────────────────────────────
# Stage 4: Production runner (minimal)
# ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Copy production node_modules and built output
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

# Run as non-root user for security
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health-check || exit 1

CMD ["node", "dist/index.js"]
