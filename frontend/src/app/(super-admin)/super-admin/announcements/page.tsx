import { db } from "@/db";
import { platformAnnouncements, schools, platformAnnouncementReads, superAdminUsers } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Bell, Send, ShieldAlert, CheckCircle2, Clock, Trash2, Megaphone } from "lucide-react";

export const metadata = {
  title: "Broadcast Center | Super Admin",
  description: "Platform announcements, system alerts, and compliance updates sent to school instances.",
};

async function broadcastAnnouncementAction(formData: FormData) {
  "use server";
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const targetType = formData.get("targetType") as string; // ALL or SPECIFIC
  const targetSchoolId = formData.get("targetSchoolId") as string;

  if (!title || !body) return;

  const [superAdmin] = await db.select().from(superAdminUsers).limit(1);
  if (!superAdmin) return;

  const target_school_ids = targetType === "SPECIFIC" && targetSchoolId ? [targetSchoolId] : null;

  await db.insert(platformAnnouncements).values({
    title,
    body,
    sentBy: superAdmin.id,
    targetSchoolIds: target_school_ids,
  });

  revalidatePath("/super-admin/announcements");
}

export default async function AnnouncementsPage() {
  const allSchools = await db.query.schools.findMany({
    orderBy: [desc(schools.name)],
  });

  const announcements = await db.query.platformAnnouncements.findMany({
    orderBy: [desc(platformAnnouncements.createdAt)],
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-indigo-400" /> Platform Broadcast Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Push platform maintenance alerts, compliance mandates, and feature announcements across all school tenants.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Broadcast Composer */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-400" /> Compose Announcement
          </h2>

          <form action={broadcastAnnouncementAction} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Announcement Title *</label>
              <input
                type="text"
                name="title"
                placeholder="e.g. Scheduled Infrastructure Upgrade · Oct 10"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Target Audience *</label>
              <select
                name="targetType"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500/50"
              >
                <option value="ALL">All School Tenants (Global Broadcast)</option>
                <option value="SPECIFIC">Specific School Tenant Only</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Select School (If specific)</label>
              <select
                name="targetSchoolId"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500/50"
              >
                <option value="">Choose tenant school...</option>
                {allSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Message Content *</label>
              <textarea
                name="body"
                rows={5}
                placeholder="Details of the announcement, downtime window, or compliance instructions..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition active:scale-95 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Announcement</span>
            </button>
          </form>
        </div>

        {/* Sent Announcements Log */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" /> Broadcast History & Active Alerts
          </h2>

          {announcements.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              No platform announcements broadcasted yet. Use the composer on the left to send your first message.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {a.targetSchoolIds ? "Targeted Tenant" : "Global Broadcast"}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1.5">{a.title}</h3>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
