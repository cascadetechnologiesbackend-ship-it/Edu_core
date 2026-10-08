"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ClarityScript() {
  const pathname = usePathname();
  const clarityProjectId =
    process.env["NEXT_PUBLIC_CLARITY_PROJECT_ID"] || "sm_clarity_baseline";

  useEffect(() => {
    // If clarity is loaded, tag page navigation for heatmap tracking on /school/*
    if (typeof window !== "undefined" && (window as any).clarity && pathname) {
      try {
        (window as any).clarity("set", "page", pathname);
        if (pathname.startsWith("/school/")) {
          (window as any).clarity("set", "section", "finance_accounts");
        }
      } catch (e) {
        // Safe fail-silent for analytics
      }
    }
  }, [pathname]);

  if (!clarityProjectId) return null;

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityProjectId}");
        `,
      }}
    />
  );
}
