export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSelfProfileAction } from "@/app/actions/profile";
import { UserProfileView } from "@/components/profile/UserProfileView";

export const metadata = {
  title: "Driver Profile | SchoolMitra ERP",
  description: "View and manage bus driver credentials, vehicle allocation and contact information.",
};

export default async function DriverProfilePage() {
  const result = await getSelfProfileAction();

  if (!result.success || !result.profile) {
    redirect("/login");
  }

  return (
    <div className="p-4 md:p-6">
      <UserProfileView
        initialProfile={result.profile}
        initialCompleteness={result.completeness!}
        initialReadOnlyDetails={result.readOnlyDetails}
      />
    </div>
  );
}
