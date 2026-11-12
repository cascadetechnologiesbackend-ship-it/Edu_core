import React from "react";
import { DedicatedSchoolOnboardingWizard } from "./DedicatedSchoolOnboardingWizard";

export const metadata = {
  title: "School Onboarding | SchoolMitra ERP",
  description: "Provision a new school tenant on SchoolMitra",
};

export default function OnboardPage() {
  return <DedicatedSchoolOnboardingWizard mode="public" />;
}
