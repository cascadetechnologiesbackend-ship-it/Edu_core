import type { Metadata } from "next";
import { DedicatedSchoolOnboardingWizard } from "@/app/onboard/page";

export const metadata: Metadata = {
  title: "Provision New School Instance | Super Admin",
  description: "Unified enterprise school provisioning wizard for CBSE, ICSE, and State Board tenants.",
};

export const dynamic = "force-dynamic";

export default function SuperAdminSchoolProvisionPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <DedicatedSchoolOnboardingWizard mode="superadmin" />
      </div>
    </div>
  );
}

