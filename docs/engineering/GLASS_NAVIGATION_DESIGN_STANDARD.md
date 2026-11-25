# Glass Navigation Design Standard

## Overview
SchoolMitra ERP uses a unified Glassmorphism navigation system across desktop and mobile shells (`Sidebar`, `Header`, `BottomNav`, `MobileBottomNav`, and `FinanceSubNav`).

## Design Tokens (`frontend/src/app/globals.css`)
- `--glass-bg`: Translucent surface background (`rgba(255, 255, 255, 0.75)` light, `rgba(28, 28, 30, 0.78)` dark).
- `--glass-blur`: Backdrop blur radius (`blur(16px)`).
- `--glass-border`: Subtle hairline border for depth separation.

## Implementation Rules
1. **Progressive Enhancement**: Always pair `backdrop-blur-xl` with `supports-[backdrop-filter]:bg-[var(--glass-bg)]` and a solid/high-opacity fallback background.
2. **Low-Tier Device Guard**: `BottomNav` disables `backdrop-blur-xl` on low-core/low-memory devices (`hardwareConcurrency <= 4` or `deviceMemory <= 4`) to preserve 60fps scrolling.
3. **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` disables transitions and `.animate-tab-pill` animations.
4. **No Logic Coupling**: Glass classes are purely presentational and must never alter routing, RBAC, or click budgets.
