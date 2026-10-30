export const dynamic = "force-dynamic";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getTeacherConversations } from "@/lib/communicationLoop";
import { TeacherMessagesClient } from "./TeacherMessagesClient";

export const metadata = {
  title: "Parent Messages | Educator Workspace | SchoolMitra ERP",
  description: "Direct academic inquiry threads with enrolled student guardians. Allocation-scoped & DPDP protected.",
};

export default async function TeacherMessagesPage() {
  const ctx = await requireAuth([
    "TEACHER",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  const threads = await getTeacherConversations(school.id, ctx.userId);

  return (
    <TeacherMessagesClient
      initialThreads={threads}
      currentUserId={ctx.userId}
    />
  );
}
