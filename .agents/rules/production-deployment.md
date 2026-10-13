---
description: Production deployment rules for Next.js 14, Turbo monorepo, and Auth.js behind reverse proxies (Render, Vercel)
globs: ["frontend/**", "backend/**", "database/**", "package.json", "render.yaml", "turbo.json"]
---

# Production Deployment & Monorepo Build Rules

## 1. Next.js Route Handlers (`route.ts`)
- Never export non-HTTP functions (e.g., helper functions, utility constants) from any `route.ts` or `route.js` file.
- Next.js strictly expects only HTTP method handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) and route segment config options (`dynamic`, `revalidate`, etc.).
- Always place shared helpers and validators in `@/lib/` or `@/server/` modules.

## 2. Production Build Dependencies in Monorepos
- In cloud build systems (Render, Vercel), `NODE_ENV=production` will skip `devDependencies`.
- Tools and packages required during build time (e.g., `turbo`, `typescript`, `postcss`, `tailwindcss`, `@types/node`, `@types/react`) must either reside in `dependencies` of the respective package or the install command must pass `--prod=false`.
- Database migration runners executed in pre-deploy / build steps (`tsx`) must have their runtime dependencies available without relying on devDependencies.
- **Never use top-level static imports for build-analysis or dev-only plugins in `next.config.mjs`**:
  - Top-level `import withBundleAnalyzer from "@next/bundle-analyzer"` will cause immediate fatal build failures (`ERR_MODULE_NOT_FOUND`) on cloud environments (Vercel, Render) running with `NODE_ENV=production`.
  - Always use conditional dynamic imports:
    `const withBundleAnalyzer = process.env.ANALYZE === "true" ? (await import("@next/bundle-analyzer")).default : null;`

## 3. NextAuth / Auth.js Behind Reverse Proxies
- When deploying behind a reverse proxy (Render web services, custom domains, or load balancers):
  - Always set `trustHost: true` in `NextAuthConfig` and declare `AUTH_TRUST_HOST=true` in environment variables.
  - Set `AUTH_URL` and `NEXTAUTH_URL` explicitly to the public HTTPS URL without trailing slashes.
  - Ensure all environment variables accessed during build are registered in `turbo.json` under `globalEnv`.
- **Health Check & Infrastructure Probe Matchers in Middleware**:
  - Never use strict equality (`pathname === "/api/health"`) for health probe bypasses in auth middleware.
  - Always use prefix matching (`pathname.startsWith("/api/health")`) so subroutes like `/api/health/worker` or `/api/health/db` are not redirected to `/login` (HTTP 307).

## 4. Git Hooks (`husky`) Guard
- Always safeguard the root `"prepare"` script in `package.json` so that cloud production builds do not fail when husky is excluded:
  `"prepare": "node -e \"if (process.env.NODE_ENV !== 'production') try { require('husky')() } catch {}\""`

## 5. Container Network Port Binding (`0.0.0.0`)
- In containerized production environments (Render, Docker, Kubernetes, Cloud Run), services MUST bind to `0.0.0.0` rather than `localhost` (127.0.0.1).
- Binding to `localhost` makes the listening port unreachable from outside the container network namespace, causing container host port scan timeouts ("Port scan timeout reached, no open ports detected").
- In Next.js:
  - Configure `"start": "next start -H 0.0.0.0"` in `package.json`.
  - Supply `HOSTNAME=0.0.0.0` in deployment specifications (e.g. `render.yaml`).
  - Declare an explicit `healthCheckPath` (e.g., `/api/health`) that returns HTTP 200 to verify service readiness.

## 6. Fail-Fast Production Secrets & Cryptographic Keys
- Never allow silent fallback to hardcoded default keys in production.
- Utility functions managing cryptographic encryption or session tokens (e.g., `encryption.ts`, `auth.config.ts`) MUST assert presence of required secrets:
  `if (process.env.NODE_ENV === "production" && !process.env.ENCRYPTION_KEY) { throw new Error("FATAL: ENCRYPTION_KEY missing in production"); }`
- Development fallbacks are permissible ONLY when `process.env.NODE_ENV !== "production"`.

## 7. Mobile PWA Standards (Android WebAPK & iOS Safari)
- **Raster PNG Icon Invariant**: Never rely solely on SVG icons in `manifest.json` for PWAs.
  - Android WebAPK packaging requires PNG icons in both `192x192` and `512x512` dimensions.
  - Provide icons with both `purpose: "any"` and `purpose: "maskable"` (ensuring maskable icons respect safe-zone margins).
- **iOS Apple Touch Icon**:
  - Safari requires an explicit `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180x180 PNG).
  - Configure Next.js metadata with `appleWebApp: { capable: true, statusBarStyle: "black-translucent" }`.
- **Service Worker Pre-caching**:
  - All manifest icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) must be registered in the service worker pre-cache list (`PRECACHE_ASSETS`) to guarantee offline launcher availability.
- **Transport Security**:
  - While standalone shortcut creation works over HTTP, native WebAPK installation on Android requires HTTPS. When provisioning production domains, enforce TLS termination.

## 8. PostgreSQL Enum Columns and Text Matching (`ILIKE`)
- Never use `ILIKE` or `LIKE` pattern matching directly on PostgreSQL enum columns (e.g. `audit_action`, `user_role`, `attendance_status`).
- PostgreSQL throws error `42883: operator does not exist: <enum_type> ~~* unknown`.
- Always explicitly cast enum columns to text before applying pattern matching:
  `sql`${column}::text ILIKE ${pattern}``

## 9. Safe Database Factory Reset & Multi-Tenant Data Clearing
- When performing a database reset or data purge:
  - Drop all dynamic schemas matching `tenant_%` using `DROP SCHEMA ... CASCADE`.
  - Truncate public tables using `TRUNCATE TABLE <tables> RESTART IDENTITY CASCADE`.
  - **Strictly Preserve**: Never truncate or drop `super_admin_users` or migration tracking tables (`__drizzle_migrations`, `drizzle.*`).
  - Always verify and reactivate Super Admin accounts (`is_active = true`) immediately after truncation.

