import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { drivers, users, schools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { User, Phone, FileText, Bus, Building2, KeyRound } from "lucide-react";
import Link from "next/link";

export default async function DriverProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;
  const schoolId = session.user.schoolId;

  const driver = await db.query.drivers.findFirst({
    where: and(eq(drivers.userId, userId), isNull(drivers.deletedAt)),
    with: {
      vehicle: true,
      school: true,
    },
  });

  const name = driver ? decryptData(driver.nameEncrypted) : session.user.name || "Driver";
  const mobile = driver ? decryptData(driver.mobileEncrypted) : "Not configured";
  const licence = driver ? decryptData(driver.licenceEncrypted) : "Not configured";
  const vehicle = driver?.vehicle;
  const school = driver?.school;

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center font-bold text-2xl mb-3">
          {name.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-xl font-bold text-white">{name}</h1>
        <p className="text-xs text-indigo-400 font-medium mt-0.5">
          Authorized School Bus Driver
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Active Account
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Driver & Vehicle Credentials
        </h2>

        <div className="divide-y divide-slate-800 text-sm">
          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" /> Mobile Number
            </span>
            <span className="font-semibold text-white">{mobile}</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" /> Driving Licence
            </span>
            <span className="font-semibold text-white font-mono">{licence}</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Bus className="w-4 h-4 text-slate-500" /> Assigned Vehicle
            </span>
            <span className="font-semibold text-indigo-400">
              {vehicle ? `${vehicle.busNumber} (${vehicle.registrationNumber})` : "Unassigned"}
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" /> School Tenant
            </span>
            <span className="font-semibold text-white">
              {school?.name || "School Mitra Tenant"}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/force-password-change"
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            Change Password
          </Link>
        </div>
      </div>
    </div>
  );
}
