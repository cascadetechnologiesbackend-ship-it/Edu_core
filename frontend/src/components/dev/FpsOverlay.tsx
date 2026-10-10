"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Dev-only FPS overlay (Spec 2.1)
 * Measures requestAnimationFrame deltas and computes rolling p50/p95 framerate.
 * Only active in development; compiles to null in production.
 */
export function FpsOverlay() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <FpsMeter />;
}

function FpsMeter() {
  const [fps, setFps] = useState(60);
  const [p95Fps, setP95Fps] = useState(60);
  const frameDeltas = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(performance.now());
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    function tick(now: number) {
      const delta = now - lastFrameTime.current;
      lastFrameTime.current = now;

      if (delta > 0) {
        frameDeltas.current.push(delta);
        if (frameDeltas.current.length > 60) {
          frameDeltas.current.shift();
        }

        // Update stats once every 30 frames to avoid setState overhead
        if (frameDeltas.current.length % 30 === 0) {
          const sorted = [...frameDeltas.current].sort((a, b) => a - b);
          const medianDelta = sorted[Math.floor(sorted.length / 2)] || 16.6;
          const p95Delta = sorted[Math.floor(sorted.length * 0.95)] || 16.6;

          setFps(Math.round(1000 / medianDelta));
          setP95Fps(Math.round(1000 / p95Delta));
        }
      }

      rafId.current = requestAnimationFrame(tick);
    }

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const color = fps >= 100 ? "text-emerald-400" : fps >= 55 ? "text-blue-400" : "text-amber-400";

  return (
    <div
      className="fixed bottom-2 right-2 z-[99999] pointer-events-none select-none
                 bg-slate-900/85 backdrop-blur border border-white/10 px-2 py-1
                 rounded text-[11px] font-mono shadow-lg flex items-center gap-1.5"
    >
      <span className={`font-bold ${color}`}>{fps} FPS</span>
      <span className="text-white/40 text-[9px]">(p95: {p95Fps})</span>
    </div>
  );
}
