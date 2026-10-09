export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSelfProfileAction } from "@/app/actions/profile";
import { UserProfileView } from "@/components/profile/UserProfileView";

export const metadata = {
  title: "Educator Profile | SchoolMitra ERP",
  description: "View and manage teacher identity, credentials, contact information and profile completeness.",
};

export default async function TeacherProfilePage() {
  const result = await getSelfProfileAction();

  if (!result.success || !result.profile) {
    redirect("/login");
  }

  return (
    <div className="p-4 md:p-8">
      <UserProfileView
        initialProfile={result.profile}
        initialCompleteness={result.completeness!}
        initialReadOnlyDetails={result.readOnlyDetails}
      />
    </div>
  );
}
