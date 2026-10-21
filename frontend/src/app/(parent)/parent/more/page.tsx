export const dynamic = "force-dynamic";

import React from "react";
import { getUnifiedParentWorkflows } from "./actions";
import { WorkflowsHubClient } from "./WorkflowsHubClient";

export const metadata = {
  title: "Requests & Records | SchoolMitra ERP",
  description: "One unified hub tracking all parent-initiated requests, applications, and decisions.",
};

export default async function ParentMorePage({
  searchParams,
}: {
  searchParams?: { studentId?: string; locale?: string; type?: string };
}) {
  const result = await getUnifiedParentWorkflows(searchParams?.studentId);

  return (
    <WorkflowsHubClient
      initialItems={result.items}
      wards={result.wards}
      locale={searchParams?.locale || "en"}
    />
  );
}
