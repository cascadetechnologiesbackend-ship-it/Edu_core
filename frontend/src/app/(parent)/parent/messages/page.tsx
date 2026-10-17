export const dynamic = "force-dynamic";

import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { parentTeacherMessages } from "@/db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { MessageSquare } from "lucide-react";

export const metadata = {
  title: "Parent-Teacher Messages | SchoolMitra ERP",
  description: "Direct moderated messaging with child's class teacher.",
};

export default async function ParentMessagesPage() {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "PARENT",
  ] as const);
  const school = await requireSchool(ctx);

  const messages = await withTenant(school.id, async (tx) => {
    return await tx.query.parentTeacherMessages.findMany({
      where: and(
        eq(parentTeacherMessages.schoolId, school.id),
        or(
          eq(parentTeacherMessages.senderUserId, ctx.userId),
          eq(parentTeacherMessages.recipientUserId, ctx.userId)
        )
      ),
      orderBy: [desc(parentTeacherMessages.createdAt)],
      limit: 20,
    });
  });

  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          Teacher Communication
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Direct, moderated messages with your child's teachers. Compliant with DPDP privacy audit logs.
        </p>
      </div>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-slate-200">
            No Messages Yet
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            When your child's teacher sends an update or notice, it will appear here and in your home feed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const isMe = msg.senderUserId === ctx.userId;
            return (
              <div
                key={msg.id}
                className={`p-4 rounded-2xl border text-sm ${
                  isMe
                    ? "bg-indigo-950/30 border-indigo-900/50 ml-6 text-indigo-100"
                    : "bg-slate-900/80 border-slate-800 mr-6 text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold text-slate-300">
                    {isMe ? "You" : "Class Teacher"}
                  </span>
                  <span>
                    {new Date(msg.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="leading-relaxed">{msg.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
