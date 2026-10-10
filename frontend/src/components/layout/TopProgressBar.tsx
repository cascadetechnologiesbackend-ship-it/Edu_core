"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * TopProgressBar — zero-delay visual navigation indicator.
 * Provides immediate feedback (0ms) the moment any internal link is clicked.
 * GPU-accelerated using `transform: scaleX()` with zero layout reflows (FPS-compliant).
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navState, setNavState] = useState<"idle" | "loading" | "finishing">("idle");
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    setNavState("loading");

    // Safety timeout in case navigation stalls or errors
    safetyTimerRef.current = setTimeout(() => {
      setNavState("idle");
    }, 6000);
  };

  const complete = () => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    setNavState("finishing");
    setTimeout(() => {
      setNavState("idle");
    }, 250);
  };

  // When pathname or search params change, the page transition is finished!
  useEffect(() => {
    if (navState !== "idle") {
      complete();
    }
  }, [pathname, searchParams]);

  // Intercept all internal link clicks for 0ms instantaneous feedback
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external links, anchor hashes, new tabs, and modifier keys
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // If clicking current path without query change, ignore
      const currentUrl = window.location.pathname + window.location.search;
      if (href === currentUrl) return;

      start();
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  if (navState === "idle") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-200"
      style={{ opacity: navState === "finishing" ? 0 : 1 }}
    >
      <div
        className="h-[3px] w-full bg-gradient-to-r from-indigo-500 via-primary to-blue-400 shadow-[0_0_10px_rgba(99,102,241,0.7)]"
        style={{
          transformOrigin: "left center",
          willChange: "transform",
          transform: navState === "finishing" ? "scaleX(1)" : undefined,
          transition: navState === "finishing" ? "transform 150ms ease-out" : undefined,
          animation: navState === "loading" ? "top-progress-indeterminate 3s cubic-bezier(0.1, 0.4, 0.1, 1) forwards" : undefined,
        }}
      />
    </div>
  );
}
