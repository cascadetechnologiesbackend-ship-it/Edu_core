# Dockerfile for SchoolMitra ERP
# Production Multi-Stage Build with Next.js Standalone Mode

# ── Base Stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# ── Dependencies Stage ───────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY database/package.json ./database/
COPY frontend/package.json ./frontend/
COPY packages/domain-events/package.json ./packages/domain-events/
COPY packages/dpdp/package.json ./packages/dpdp/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/validators/package.json ./packages/validators/

RUN pnpm install --frozen-lockfile

# ── Build Stage ──────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/database/node_modules ./database/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/packages/domain-events/node_modules ./packages/domain-events/node_modules
COPY --from=deps /app/packages/dpdp/node_modules ./packages/dpdp/node_modules
COPY --from=deps /app/packages/i18n/node_modules ./packages/i18n/node_modules
COPY --from=deps /app/packages/validators/node_modules ./packages/validators/node_modules

COPY . .

ENV NODE_ENV=production
ENV NEXT_OUTPUT_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @schoolmitra/database run type-check
RUN pnpm --filter @schoolmitra/validators run type-check
RUN pnpm --filter @schoolmitra/frontend build

# ── Production Runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
