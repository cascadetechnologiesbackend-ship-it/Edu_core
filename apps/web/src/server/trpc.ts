import { initTRPC, TRPCError } from "@trpc/server";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Session } from "next-auth";
import type { Role } from "@schoolmitra/validators";

// ─── Context ─────────────────────────────────────────────────────────────────

export interface TRPCContext {
  db: typeof db;
  session: Session | null;
  req: NextRequest;
  ip: string;
  userAgent: string;
}

export async function createTRPCContext({
  req,
  session,
}: {
  req: NextRequest;
  session: Session | null;
}): Promise<TRPCContext> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  return {
    db,
    session,
    req,
    ip,
    userAgent,
  };
}

// ─── tRPC Initialisation ──────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ─── Router / Procedure builders ─────────────────────────────────────────────

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimiter";
import { trpcLogger } from "@/lib/logger";

/**
 * Logging middleware — PII-safe structured logging.
 * NEVER logs PII field values.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (process.env["NODE_ENV"] === "development") {
    trpcLogger.info(`[tRPC] ${path} — ${durationMs}ms`);
  }

  return result;
});

/**
 * Rate Limiting Middleware
 */
const rateLimitMiddleware = t.middleware(async ({ ctx, next, path }) => {
  if (process.env.NODE_ENV !== "development") {
    const isAuth = !!ctx.session?.user?.id;
    const limits = isAuth
      ? RATE_LIMITS.AUTHENTICATED
      : RATE_LIMITS.UNAUTHENTICATED;
    const key = isAuth
      ? `ratelimit:user:${ctx.session!.user!.id}`
      : `ratelimit:ip:${ctx.ip}`;

    const allowed = await checkRateLimit(key, limits.max, limits.windowMs);

    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please try again later.",
      });
    }
  }
  return next({ ctx });
});

/**
 * Auth middleware — ensures user is authenticated.
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * Role-based access control middleware factory.
 * Usage: withRole(["SCHOOL_ADMIN", "PRINCIPAL"])
 */
export function withRole(allowedRoles: readonly Role[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const userRole = ctx.session.user.role as Role | undefined;

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }

    return next({ ctx });
  });
}

// ─── Procedure exports ────────────────────────────────────────────────────────

/** Public procedure — no auth required */
export const publicProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware);

/** Protected procedure — requires authentication */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed);

/** Admin procedure — Super Admin or School Admin only */
export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["SUPER_ADMIN", "SCHOOL_ADMIN"]));

/** Principal procedure — Principal, School Admin, Super Admin */
export const principalProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]));

/** HR procedure — HR Manager access */
export const hrProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "HR_MANAGER"]));

/** Librarian procedure */
export const librarianProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"]));

/** Transport Manager procedure */
export const transportManagerProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"]));

/** Accountant procedure */
export const accountantProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"]));

/** Teacher procedure */
export const teacherProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]));

/** Parent procedure */
export const parentProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(isAuthed)
  .use(withRole(["PARENT"]));
