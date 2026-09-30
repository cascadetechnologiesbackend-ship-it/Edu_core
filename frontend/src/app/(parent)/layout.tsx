import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: {
    default: "Parent Portal",
    template: "%s | Parent | SchoolMitra ERP",
  },
};

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate active subdomain tenant
  await getActiveTenant();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* For MVP, parent doesn't have a full sidebar, just a header and full content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header breadcrumbs={[{ label: "Parent Portal", href: "/portal" }]} />

        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          role="main"
          aria-label="Main content"
        >
          <div className="p-6 max-w-screen-2xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
