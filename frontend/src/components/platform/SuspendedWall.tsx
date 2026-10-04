import { ShieldAlert, Mail, Phone, ExternalLink } from "lucide-react";
import Link from "next/link";

interface SuspendedWallProps {
  schoolName?: string;
  reason?: string | null;
  supportEmail?: string;
  supportPhone?: string;
}

export function SuspendedWall({
  schoolName = "School Instance",
  reason = "Administrative review pending by platform operator",
  supportEmail = "support@schoolmitra.in",
  supportPhone = "+91 80 4000 8899",
}: SuspendedWallProps) {
  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-6 text-slate-200">
      <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Administrative Suspension
          </span>
          <h1 className="text-xl font-bold text-white mt-3">
            School Instance Temporarily Suspended
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Access to <strong className="text-slate-200">{schoolName}</strong> has been temporarily placed on administrative hold by the platform administrator.
          </p>
        </div>

        {/* Reason Box */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs space-y-1">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Official Reason Stated
          </div>
          <p className="text-slate-300 font-medium leading-relaxed">
            {reason ?? "Administrative review pending by platform operator"}
          </p>
        </div>

        {/* Contact Support */}
        <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="text-[11px] font-semibold text-slate-300">
            Need assistance or wish to request reactivation?
          </div>
          <div className="flex items-center justify-center gap-4 text-slate-300">
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-1.5 hover:text-indigo-400 transition"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              <span>{supportEmail}</span>
            </a>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{supportPhone}</span>
            </span>
          </div>
        </div>

        <div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
          >
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
