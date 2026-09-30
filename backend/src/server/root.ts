import { createTRPCRouter } from "./trpc";
import { admissionsRouter } from "./routers/admissions";
import { studentsRouter } from "./routers/students";
import { attendanceRouter } from "./routers/attendance";

export const appRouter = createTRPCRouter({
  admissions: admissionsRouter,
  students: studentsRouter,
  attendance: attendanceRouter,
});

export type AppRouter = typeof appRouter;
