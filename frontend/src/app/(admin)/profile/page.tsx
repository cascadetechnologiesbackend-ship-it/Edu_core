export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSelfProfileAction } from "@/app/actions/profile";
import { UserProfileView } from "@/components/profile/UserProfileView";

export const metadata = {
  title: "My Profile & Identity | SchoolMitra ERP",
  description: "View and manage your identity, credentials, contact information and profile completeness.",
};

export default async function AdminProfilePage() {
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
