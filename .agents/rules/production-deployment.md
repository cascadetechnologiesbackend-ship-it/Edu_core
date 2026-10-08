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

## 3. NextAuth / Auth.js Behind Reverse Proxies
- When deploying behind a reverse proxy (Render web services, custom domains, or load balancers):
  - Always set `trustHost: true` in `NextAuthConfig` and declare `AUTH_TRUST_HOST=true` in environment variables.
  - Set `AUTH_URL` and `NEXTAUTH_URL` explicitly to the public HTTPS URL without trailing slashes.
  - Ensure all environment variables accessed during build are registered in `turbo.json` under `globalEnv`.

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
