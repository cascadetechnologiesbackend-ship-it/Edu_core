export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSelfProfileAction } from "@/app/actions/profile";
import { UserProfileView } from "@/components/profile/UserProfileView";

export const metadata = {
  title: "Platform Administrator Profile | SchoolMitra ERP",
  description: "View and manage super admin credentials and preferences.",
};

export default async function SuperAdminProfilePage() {
  const result = await getSelfProfileAction();

  if (!result.success || !result.profile) {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-8">
      <UserProfileView
        initialProfile={result.profile}
        initialCompleteness={result.completeness!}
        initialReadOnlyDetails={result.readOnlyDetails}
      />
    </div>
  );
}
