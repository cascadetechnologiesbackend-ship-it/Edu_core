import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Format for better readability in development, standard JSON in production
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  }),
});

export const workerLogger = logger.child({ context: "worker" });
export const trpcLogger = logger.child({ context: "trpc" });
