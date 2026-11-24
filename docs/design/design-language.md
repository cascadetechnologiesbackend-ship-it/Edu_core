# SchoolMitra Design Language Specification

> **Status:** Binding Product Design Law (Phase AD-L0 Review Gate)  
> **Governing Charter:** [SchoolMitra Product Destination Charter](file:///v:/Cascade/2026/Edu_core/docs/product-destination-charter.json)  
> **Source Specification:** [Apple HIG Design System v2.0.0](file:///v:/Cascade/2026/Edu_core/docs/apple-design-system-spec.json) (`apple_hig_design_system_v2`)  
> **Target Audience:** All product engineers, UI developers, QA, and agents across SchoolMitra  
> **Scope:** Universal across all 11 role applications, auth, landing, onboarding, and super-admin  

---

## 1. Core Philosophy: Clarity, Deference & Depth

SchoolMitra's design language is founded upon the Apple Human Interface Guidelines (HIG). The primary product thesis dictates that **the software must look and feel like an audited, legal-grade institutional ledger, not a toy dashboard**.

1. **Clarity:** Text is legible at every size; icons are precise and optically aligned; adornments are subtle. Visual weight is strictly dictated by operational function.
2. **Deference:** The interface helps people understand and operate their school, never competing with their data. Chrome recedes into the background; the school's operational truth is the hero.
3. **Depth:** Realistic spatial layers and physics-based motion convey hierarchy. The application feels spatial through translucent materials and progressive lightening, never artificial decoration or colored shadows.
4. **Color with Single Intention:** Color communicates status, feedback, and interactivity. **The same color must never mean two things.** Expressive color occupies a strict minority of screen pixels.
5. **One Interactive Tint:** Exactly one accent color indicates interactivity (`apple.blue`). Non-interactive elements must never wear this tint.
6. **Pure Neutral Surfaces:** Dark Mode uses desaturated neutral grays on true black OLED. Dark mode is **never** a navy blue-tinted theme.

---

## 2. The 60/30/10 Visual Weight Budget

To preserve deference and eliminate visual fatigue for school administrators and teachers who use the platform 8 hours a day, every screen must strictly adhere to the **60/30/10 Visual Weight Budget**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     60/30/10 VISUAL WEIGHT BUDGET                      │
├────────────────────────────────────────────────────────────────────────┤
│ 60%  NEUTRAL SURFACES                                                  │
│      Canvas (#000000 / #F2F2F7), cards (#1C1C1E / #FFFFFF),            │
│      grouped containers, sheets, popovers. Recedes completely.         │
├────────────────────────────────────────────────────────────────────────┤
│ 30%  STRUCTURAL GRAYS & TYPOGRAPHY                                     │
│      Primary text, secondary labels, hairline separators, inactive     │
│      icons, table headers, border structures, disabled states.         │
├────────────────────────────────────────────────────────────────────────┤
│ ≤10% SEMANTIC COLOR & INTERACTIVE TINT                                 │
│      Interactive tint (apple.blue) + operational status dots/badges     │
│      (green, red, orange, yellow). Directs attention with surgical     │
│      precision. Never decorative.                                      │
└────────────────────────────────────────────────────────────────────────┘
```

- **60% Neutral Surfaces:** Base canvas, content cards, grouped containers, and popovers. These surfaces must be purely achromatic and provide quiet, spatial depth.
- **30% Structural Grays:** All typography (`label`, `secondaryLabel`, `tertiaryLabel`), hairline dividers, borders, inactive navigation icons, table headers, and disabled states. Structure establishes hierarchy without competing with content.
- **≤ 10% Expressive Semantic Color:** The single interactive tint (`apple.blue`) plus status indicators (`apple.green`, `apple.red`, `apple.orange`, `apple.yellow`). If a dashboard screams or uses color on cards, containers, or headers, it fails the deference law and will be rejected.

---

## 3. Attention Hierarchy & Eye-Tracking Heatmap Logic

Every screen across SchoolMitra must answer three fundamental human questions in one instantaneous glance, strictly in this order:

```
Glance 1: "What is my next action?"
└── Exactly ONE element in apple.blue in the primary action zone.

Glance 2: "What needs my attention?"
└── Semantic colors (orange, red, green) ONLY where operational status exists.

Glance 3: "What is the state of my data?"
└── Neutral typography with tabular numerals. Everything else is achromatic gray.
```

### The Heatmap Invariant
Human eye-tracking studies confirm that the eye lands on the top-left primary heading, sweeps the primary action zone, and then chases saturated color.
- A screen with ten colored elements has **zero hierarchy** and chaotic eye-tracking.
- By restricting color to **one interactive tint** and **discrete status badges**, the user completes workflows in under 4 taps without cognitive overhead.

---

## 4. Exhaustive Color Intention Map (`color_intention_map`)

The rule is absolute: **One meaning, one color, everywhere.**  
Every entry below renders identically across all 11 role applications, both appearances, via canonical semantic tokens. Any data element or text not defined in this table is **neutral gray**.

| Intention Name | Semantic Token Name | Light Mode Hex | Dark Mode Hex | Canonical Owner ("Owns") | Strict Prohibition ("Never") |
|---|---|---|---|---|---|
| **Interactive Tint** | `semantic-interactive`<br/>`apple.blue` | `#007AFF`<br/>`rgb(0, 122, 255)` | `#0A84FF`<br/>`rgb(10, 132, 255)` | Primary filled CTA button, clickable text links, selected states, focus rings, active segmented control thumb, active navigation items, progress bar fills of ongoing work. | **NEVER** on non-interactive text, **NEVER** as static category badge, **NEVER** as section decoration, **NEVER** on a second filled button in the same action row. |
| **Money In / Healthy / Done** | `semantic-money-in`<br/>`apple.green` | `#34C759`<br/>`rgb(52, 199, 89)` | `#30D158`<br/>`rgb(48, 209, 88)` | Fees collected, payments received, gateway reconciled, verified student documents, exam results published, attendance present, staff leaves approved, completed tasks. | **NEVER** on interactive buttons, **NEVER** on navigation tabs, **NEVER** on card backgrounds, **NEVER** on marketing banners. |
| **Money Owed / Error / Absent** | `semantic-money-owed`<br/>`apple.red` | `#FF3B30`<br/>`rgb(255, 59, 48)` | `#FF453A`<br/>`rgb(255, 69, 58)` | Overdue fees, failed transactions, absent students, rejected leaves, destructive actions (delete, withdraw, revoke), system errors, exam failures below pass mark. | **NEVER** on secondary buttons; destructive action in a shared row must be plain red text. Filled red allowed **ONLY** in isolated confirmation dialogs. |
| **Attention / Due Soon / Pending** | `semantic-attention`<br/>`apple.orange` | `#FF9500`<br/>`rgb(255, 149, 0)` | `#FF9F0A`<br/>`rgb(255, 159, 10)` | Upcoming fee deadlines, pending approvals, unpaid-but-not-overdue fees, exam marks awaiting lock, weak attendance trends, everything pending a human decision. | **NEVER** for ordinary body text, **NEVER** as a large background container fill. |
| **Provisional / Draft** | `semantic-provisional`<br/>`apple.yellow` | `#FFCC00`<br/>`rgb(255, 204, 0)` | `#FFD60A`<br/>`rgb(255, 214, 10)` | Draft states, provisional / unauthenticated data, in-progress bulk import operations. | Used **ONLY** as a dot or badge tint; **NEVER** on large card fills or buttons. |
| **Exam Domain Identity** | `semantic-exam-domain`<br/>`apple.indigo` | `#5856D6`<br/>`rgb(88, 86, 214)` | `#5E5CE6`<br/>`rgb(94, 92, 230)` | Exam lifecycle and evaluation surfaces as a fixed sidebar icon and module header badge **ONLY**. | **NEVER** on action buttons, **NEVER** on table cells, **NEVER** on status badges. |
| **Structure & Neutral** | `semantic-neutral`<br/>`systemGray` | Steps `#8E8E93` down to `#F2F2F7` | Steps `#8E8E93` down to `#1C1C1E` | All surfaces, canvas, cards, separators, borders, secondary/tertiary text, disabled states, informational badges. | N/A — When in doubt, default to **neutral gray**. |

---

## 5. Theme Specifications: Light & Dark Modes

### 5.1 Light Mode Appearance
- **Base Canvas:** `systemGroupedBackground` `#F2F2F7` (pure desaturated light gray).
- **Primary Grouping / Cards:** Pure White `#FFFFFF`.
- **Secondary / Elevated Surfaces:** `#F2F2F7` / `#E5E5EA`.
- **Hairline Separators:** `#C6C6C8` (0.5px hairline or `border-border/60`).
- **Typography Scale:**
  - `label`: `#000000` (100% opacity)
  - `secondaryLabel`: `rgba(60, 60, 67, 0.60)` (60% opacity)
  - `tertiaryLabel`: `rgba(60, 60, 67, 0.30)` (30% opacity)
  - `quaternaryLabel`: `rgba(60, 60, 67, 0.18)` (placeholder / subtle chrome)

### 5.2 Dark Mode Appearance (Zero Hue-222 / Zero Navy)
Apple Dark Mode is achromatic. Blue-tinted navy (`#0B0F19`, `222 47% 7%`, `#0F1422`) is completely eradicated.
- **Base Canvas:** True Black OLED `#000000` (`--background: 0 0% 0%`).
- **Primary Cards & Containers:** `#1C1C1E` (`--card: 240 3% 11%`).
- **Elevated Surfaces (Modals / Popovers):** `#2C2C2E` (`--card-elevated: 240 2% 17%`).
- **Further Elevated (Floating Sheets / Pickers):** `#3A3A3C` (`240 2% 23%`).
- **Hairline Separators:** `rgba(84, 84, 88, 0.65)` (`--separator: 240 2% 34%`).
- **Typography Scale:**
  - `label`: `#FFFFFF` (100% opacity)
  - `secondaryLabel`: `rgba(235, 235, 245, 0.60)` (60% opacity)
  - `tertiaryLabel`: `rgba(235, 235, 245, 0.30)` (30% opacity)
  - `quaternaryLabel`: `rgba(235, 235, 245, 0.16)` (placeholder / disabled)

### 5.3 The Law of Progressive Lightening
- In dark mode, surfaces elevate by **lightening their base surface tone**, **NEVER** by casting colored drop shadows.
- Drop shadows are drastically reduced in dark mode. Depth is expressed through neutral frosted materials (`backdrop-blur-xl`, `saturate(190%)`) and razor-sharp hairline borders.

---

## 6. Navigation, Sidebars & Shells

### 6.1 Sidebar Specifications
The sidebar follows Apple macOS / iPadOS translucent sidebar architecture:
- **Light Appearance:** `systemGray-6` translucent material (`#F2F2F7` family with `backdrop-blur-xl`).
- **Dark Appearance:** Neutral translucent dark material (`#161616` to `#1C1C1E` with vibrancy). Zero navy.
- **Active Navigation Row:**
  - Light mode: Low-opacity tinted fill `rgba(0, 122, 255, 0.10)` with tinted `#007AFF` label and icon.
  - Dark mode: Low-opacity tinted fill `rgba(10, 132, 255, 0.15)` with tinted `#0A84FF` label and icon.
  - Visited states do not exist.
- **Fixed Section Icons (HIG Convention):**
  - Section icons carry dedicated identity colors for quick spatial recognition:
    - **Transport:** Teal (`#5AC8FA`)
    - **Finance / Accounts:** Green (`#34C759`)
    - **Exams & Marks:** Indigo (`#5856D6`)
    - **Attendance:** Blue (`#007AFF`)
    - **Library:** Yellow (`#FFCC00`)
    - **HR & Settings:** Neutral Gray (`#8E8E93`)
  - **Constraint:** Fixed colors apply **ONLY** to the icon graphic itself; row backgrounds must remain neutral.

---

## 7. Typography Scale & Tabular Figures

SchoolMitra uses **Inter** with tuned letter-spacing and font-weights as the honest web substitute for Apple's SF Pro. No claims of proprietary SF Pro licensing are made in documentation.

### 7.1 Type Scale Hierarchy
| Level | Font Size | Font Weight | Line Height | Letter Spacing (Tracking) | Usage Context |
|---|---|---|---|---|---|
| **Large Title** | 34px (`2.125rem`) | 700 (Bold) | 41px | `-0.022em` | Main page header titles |
| **Title 1** | 28px (`1.750rem`) | 700 (Bold) | 34px | `-0.021em` | Section hub headers |
| **Title 2** | 22px (`1.375rem`) | 700 (Bold) | 28px | `-0.018em` | MetricCard numeric values |
| **Title 3** | 20px (`1.250rem`) | 600 (Semibold) | 25px | `-0.017em` | Card titles, modal headers |
| **Headline** | 17px (`1.063rem`) | 600 (Semibold) | 22px | `-0.015em` | List item titles, emphasis |
| **Body** | 17px (`1.063rem`) | 400 (Regular) | 22px | `-0.015em` | General body copy, inputs |
| **Callout** | 16px (`1.000rem`) | 400 (Regular) | 21px | `-0.013em` | Form helper callouts |
| **Subhead** | 15px (`0.938rem`) | 400 (Regular) | 20px | `-0.010em` | Subtitles, row metadata |
| **Footnote** | 13px (`0.813rem`) | 400 (Regular) | 18px | `-0.005em` | MetricCard labels, timestamps |
| **Caption 1** | 12px (`0.750rem`) | 500 (Medium) | 16px | `0.000em` | Section headers (uppercase) |
| **Caption 2** | 11px (`0.688rem`) | 400 (Regular) | 13px | `+0.005em` | Micro-badges, legal tags |

### 7.2 Tabular Numerals Law
- All financial sums, rupee values (`₹`), dates, timestamps, exam marks, roll numbers, percentages, and metrics **must** activate tabular figures:
  ```css
  font-feature-settings: "tnum" 1;
  /* Tailwind equivalent: tabular-nums font-mono */
  ```
- This ensures columns of numbers align optically and eliminates column shudder during live data updates.

---

## 8. Component Grammar

### 8.1 Button Hierarchy & Action Row Law
Buttons are categorized into five distinct tiers.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BUTTON TIERS SPECIFICATION                      │
├───────────────┬──────────────────────────────────┬─────────────────────┤
│ TIER          │ VISUAL TREATMENT                 │ PURPOSE             │
├───────────────┼──────────────────────────────────┼─────────────────────┤
│ 1. FILLED     │ Solid apple.blue background,     │ Single primary CTA  │
│               │ white bold text.                 │ per action row.     │
├───────────────┼──────────────────────────────────┼─────────────────────┤
│ 2. TINTED     │ 12% apple.blue fill,             │ Secondary actions   │
│               │ solid apple.blue text.           │ in same row.        │
├───────────────┼──────────────────────────────────┼─────────────────────┤
│ 3. PLAIN      │ Transparent background,          │ Tertiary actions,   │
│               │ apple.blue text only.            │ toolbar links.      │
├───────────────┼──────────────────────────────────┼─────────────────────┤
│ 4. GRAY       │ Neutral systemGray-5 fill,       │ Neutral dismiss,    │
│               │ primary label text.              │ Cancel, Back.       │
├───────────────┼──────────────────────────────────┼─────────────────────┤
│ 5. DESTRUCTIVE│ Plain red text in shared rows;   │ Dangerous actions   │
│               │ Filled red ONLY in solo dialogs. │ (Delete, Revoke).   │
└───────────────┴──────────────────────────────────┴─────────────────────┘
```

#### The Strict Action Row Law
- **Exactly ONE filled button per action row.**
- A secondary action in the same container must be **tinted**, **plain**, or **gray**.
- When a destructive action appears alongside a primary button, it must be **plain red text**, **NEVER** filled red next to filled blue.
- **Touch Target Dimensions:** Minimum 44px height for mobile/touch screens; 36px compact density for dense desktop data tables; 12px border radius (`rounded-xl`); `active:scale-[0.97]` micro-interaction.

---

### 8.2 SegmentedControl
Replaces all ad-hoc tabs for in-page view switching.
- **Track:** Achromatic neutral track (`#E5E5EA` light / `#2C2C2E` dark), height 36px, `rounded-xl`, padding 2px.
- **Thumb:** White card in light mode, `#636366` in dark mode, with smooth sliding physics (`tab-pill` keyframes).
- **Active Label:** Semibold label with zero underline decoration.

---

### 8.3 InsetGroupedList
The universal container for forms, account lists, settings, and student rosters:
- **Card Container:** Rounded card (`rounded-2xl`), neutral background (`#FFFFFF` light / `#1C1C1E` dark), border `border-border/60`.
- **Rows:** Full-width rows with minimum height 48px, horizontal padding `px-4`.
- **Inset Separators:** Hairline separators inset by 52px from the left edge (aligned perfectly with text labels, not the leading icon). The final row has no separator.
- **Affordance:** Navigable rows feature a trailing chevron (`ChevronRight`, 16px, `text-muted-foreground/60`).
- **Section Headers:** 12px uppercase section titles in secondary text with 16px bottom padding.

---

### 8.4 StatusBadge Semantic Consolidation
`StatusBadge` is the single authoritative source of operational status color in SchoolMitra. All ad-hoc colored pills and badges are deprecated.
- **Status Mapping Table:**
  - `active`, `completed`, `paid`, `present`, `verified`, `published` ➔ `semantic-money-in` (`apple.green`)
  - `pending`, `due_soon`, `review`, `awaiting_lock`, `in_progress` ➔ `semantic-attention` (`apple.orange`)
  - `overdue`, `failed`, `absent`, `rejected`, `error`, `suspended` ➔ `semantic-money-owed` (`apple.red`)
  - `draft`, `provisional`, `unauthenticated` ➔ `semantic-provisional` (`apple.yellow`)
  - `neutral`, `info`, `archived` ➔ `semantic-neutral` (`systemGray`)
- **Badge Anatomy:** Compact pill (`rounded-full`), height 22px, `px-2.5 py-0.5`, 12px font (`text-xs font-semibold`), 4.5:1 contrast pair against its own surface.

---

### 8.5 MetricCard & DataTable Grammar
- **MetricCard:**
  - Primary numeric value rendered in **Title 2 (22px bold)** with tabular figures (`tabular-nums font-mono`).
  - Label rendered in **Footnote (13px)** secondary text.
  - Trend indicator rendered in semantic green/red **ONLY** when an actual non-zero delta exists. If delta is 0%, trend indicator is neutral gray.
  - Neutral card background; zero colored cards.
- **DataTable:**
  - Hairline dividers between rows (`0.5px`). Zero zebra striping.
  - Numeric columns strictly right-aligned with tabular numerals.
  - Operational status expressed exclusively via `StatusBadge`.

---

## 9. Forbidden Design Practices & CI Rules

The following practices are permanently prohibited and will trigger build failures via the CI Guard scanner script `scripts/audit-design-tokens.mjs` (Phase AD-L6):

```
┌────────────────────────────────────────────────────────────────────────┐
│                     PERMANENTLY FORBIDDEN PRACTICES                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Navy Residue: No hue-222/223 variables, no #0f172a, no #1e40af │
│ 2. Zero Banned Palettes: No slate, zinc, emerald, rose, amber classes. │
│ 3. Zero Multi-Filled Action Rows: Max 1 filled button per row.         │
│ 4. Zero Green Buttons: Green is reserved exclusively for money_in.     │
│ 5. Zero Blue Non-Interactive Text: Blue is strictly for controls.      │
│ 6. Zero Decorative Gradients: Gradients on cards/headers are banned.   │
│ 7. Zero Colored Shadows: No blue casts on hover drop shadows.          │
│ 8. Zero Zebra Striping: Tables use clean hairlines on neutral white.   │
└────────────────────────────────────────────────────────────────────────┘
```

### Contrast Law
Every text, icon, and badge combination must mechanically pass a **minimum 4.5:1 contrast ratio** (3:1 for large text ≥ 18pt) in light mode, dark mode, and forced-colors mode.

---

## 10. Phase AD-L0 Review Gate Criteria

To pass the Phase AD-L0 Review Gate and proceed to Phase AD-L1, the following conditions must be verified:
1. **Document Completeness:** `docs/design/color-audit.md` and `docs/design/design-language.md` exist and contain verified empirical data from the 754-file mechanical audit.
2. **Zero Styling Diffs:** `git status -s` confirms that zero files under `frontend/src` have been altered during Phase AD-L0.
3. **Mechanical Verification:** The audit scanner script at `scripts/audit-color-tokens.mjs` executes cleanly and deterministically in under 1,500ms.
4. **Operator Ratification:** The design laws, color intention map, and component grammar documented herein are ratified as the binding product standard for the remainder of the migration.

---

## 11. Migration Ratification & Release Sign-Off (Phases AD-L0 through AD-L7)

The Apple HIG Design System v2 migration has landed across the entire SchoolMitra codebase under governing charter `docs/product-destination-charter.json`.

- **Neutral Dark System:** Completed. Zero hue-222 values remain in `globals.css`. Pure black canvas (`#000000`), neutral card (`#1C1C1E`), and elevated surfaces (`#2C2C2E`) are active across all 11 role apps.
- **Single-Intention Color Coding:** Completed. Semantic intention tokens (`semantic-interactive`, `semantic-money-in`, `semantic-money-owed`, `semantic-attention`, `semantic-provisional`) faithfully govern visual meaning.
- **Component Grammar:** Completed. 1-filled-button invariant strictly enforced; segmented controls with pill-thumb animations standard; inset grouped containers standard; tabular numerals enforced on all monetary values and percentages.
- **Mechanical CI Guard & WCAG Audit:** Active in `scripts/audit-design-tokens.mjs` and `frontend/src/__tests__/tokens/contrast-audit.test.ts`. 21/21 strict core surfaces clean of banned tokens; 21/21 semantic pairs exceed WCAG AA contrast thresholds; 34/34 unit tests passing; 0 TypeScript errors.

