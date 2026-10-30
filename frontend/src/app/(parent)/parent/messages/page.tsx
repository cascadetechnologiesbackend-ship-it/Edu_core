export const dynamic = "force-dynamic";

import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  getParentConversations,
  resolveChildTeachers,
} from "@/lib/communicationLoop";
import { ParentMessagesClient } from "./ParentMessagesClient";

export const metadata = {
  title: "Teacher Communication | SchoolMitra ERP",
  description: "Direct moderated messaging with child's teachers.",
};

export default async function ParentMessagesPage() {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "PARENT",
  ] as const);
  const school = await requireSchool(ctx);

  const [initialThreads, availableTeachers] = await Promise.all([
    getParentConversations(school.id, ctx.userId),
    resolveChildTeachers(school.id, ctx.userId),
  ]);

  return (
    <div className="py-2">
      <ParentMessagesClient
        initialThreads={initialThreads}
        availableTeachers={availableTeachers}
        currentUserId={ctx.userId}
      />
    </div>
  );
}
