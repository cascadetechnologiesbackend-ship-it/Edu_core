"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * TopProgressBar — zero-delay visual navigation indicator.
 * Provides immediate feedback (0ms) the moment any internal link is clicked,
 * eliminating the perception of lag/freeze during Next.js App Router transitions.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);

    setVisible(true);
    setProgress(15);

    // Incrementally increase progress to show active loading
    let current = 15;
    timerRef.current = setInterval(() => {
      current += Math.random() * 15;
      if (current >= 85) {
        current = 85;
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setProgress(current);
    }, 120);

    // Safety timeout in case navigation is cancelled or errors
    safetyTimerRef.current = setTimeout(() => {
      complete();
    }, 5000);
  };

  const complete = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);

    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  };

  // When pathname or search params change, the page transition is finished!
  useEffect(() => {
    complete();
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

      // If clicking the current path without query change, ignore
      const currentUrl = window.location.pathname + window.location.search;
      if (href === currentUrl) return;

      start();
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-[3px] bg-gradient-to-r from-indigo-500 via-primary to-blue-400 shadow-[0_0_10px_rgba(99,102,241,0.7)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
        }}
      />
    </div>
  );
}
