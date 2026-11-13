"use client";

import React, { useEffect, useState, useCallback } from "react";

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightOverlayProps {
  targetElement: HTMLElement | null;
  padding?: number;
  borderRadius?: number;
  onClickCutout?: () => void;
}

export function SpotlightOverlay({
  targetElement,
  padding = 6,
  borderRadius = 12,
  onClickCutout,
}: SpotlightOverlayProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const updateRect = useCallback(() => {
    if (!targetElement) {
      setRect(null);
      return;
    }
    const bounds = targetElement.getBoundingClientRect();
    setRect({
      top: bounds.top,
      left: bounds.left,
      width: bounds.width,
      height: bounds.height,
    });
  }, [targetElement]);

  useEffect(() => {
    updateRect();
    if (!targetElement) return;

    // Smoothly scroll into view if target element is outside viewport
    const bounds = targetElement.getBoundingClientRect();
    const inViewport =
      bounds.top >= 0 &&
      bounds.left >= 0 &&
      bounds.bottom <= window.innerHeight &&
      bounds.right <= window.innerWidth;

    if (!inViewport) {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }

    const handleScrollOrResize = () => {
      updateRect();
    };

    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [targetElement, updateRect]);

  if (!rect) return null;

  const cutoutX = Math.max(0, rect.left - padding);
  const cutoutY = Math.max(0, rect.top - padding);
  const cutoutWidth = rect.width + padding * 2;
  const cutoutHeight = rect.height + padding * 2;

  return (
    <div
      data-testid="spotlight-overlay"
      className="fixed inset-0 z-[9990] pointer-events-none select-none transition-opacity duration-300"
    >
      {/* SVG Mask for seamless darkened cutout */}
      <svg className="w-full h-full absolute inset-0">
        <defs>
          <mask id="spotlight-mask">
            {/* White reveals overlay background */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black punches transparent hole over anchored target */}
            <rect
              x={cutoutX}
              y={cutoutY}
              width={cutoutWidth}
              height={cutoutHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(2, 6, 23, 0.72)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Target Halo Glow & Highlighting Border */}
      <div
        data-testid="spotlight-halo"
        className="fixed pointer-events-none rounded-xl border-2 border-indigo-400 dark:border-indigo-400/90 shadow-[0_0_24px_rgba(99,102,241,0.45)] transition-all duration-200"
        style={{
          top: `${cutoutY}px`,
          left: `${cutoutX}px`,
          width: `${cutoutWidth}px`,
          height: `${cutoutHeight}px`,
        }}
      />
    </div>
  );
}

