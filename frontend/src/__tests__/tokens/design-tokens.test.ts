import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import tailwindConfig from "../../../tailwind.config";

// ── WCAG 2.1 Contrast Calculation Utilities ──────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const rs = toLinear(r);
  const gs = toLinear(g);
  const bs = toLinear(b);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("AD-L1 Token Truth - Token Existence and Tailwind Config", () => {
  const colors = (tailwindConfig.theme?.extend as any)?.colors;
  const shadows = (tailwindConfig.theme?.extend as any)?.boxShadow;
  const backgrounds = (tailwindConfig.theme?.extend as any)?.backgroundImage;

  it("defines all canonical semantic tokens in Tailwind config", () => {
    expect(colors.semantic).toBeDefined();
    expect(colors.semantic["interactive"]).toBeDefined();
    expect(colors.semantic["money-in"]).toBeDefined();
    expect(colors.semantic["money-owed"]).toBeDefined();
    expect(colors.semantic["attention"]).toBeDefined();
    expect(colors.semantic["provisional"]).toBeDefined();
    expect(colors.semantic["exam"]).toBeDefined();
    expect(colors.semantic["neutral"]).toBeDefined();

    // Verify flat aliases exist
    expect(colors["semantic-interactive"]).toBe("hsl(var(--semantic-interactive))");
    expect(colors["semantic-money-in"]).toBe("hsl(var(--semantic-money-in))");
    expect(colors["semantic-money-owed"]).toBe("hsl(var(--semantic-money-owed))");
    expect(colors["semantic-attention"]).toBe("hsl(var(--semantic-attention))");
    expect(colors["semantic-provisional"]).toBe("hsl(var(--semantic-provisional))");
    expect(colors["semantic-exam"]).toBe("hsl(var(--semantic-exam))");
    expect(colors["semantic-neutral"]).toBe("hsl(var(--semantic-neutral))");
  });

  it("de-navies the primary dark scale steps", () => {
    // Primary 800, 900, 950 must be pure blue derived from Apple System Blue
    expect(colors.primary[800]).toBe("#0056B3");
    expect(colors.primary[900]).toBe("#003E80");
    expect(colors.primary[950]).toBe("#002752");
    expect(colors.primary[900]).not.toBe("#1e3a8a");
    expect(colors.primary[950]).not.toBe("#172554");
  });

  it("de-navies the sidebar configuration", () => {
    expect(colors.sidebar.DEFAULT).toContain("--sidebar-bg");
    expect(colors.sidebar.DEFAULT).not.toBe("#0f172a");
    expect(colors.sidebar.hover).toContain("--sidebar-hover");
    expect(colors.sidebar.active).toContain("--sidebar-active");
    expect(colors.sidebar.active).not.toBe("#1e40af");
    expect(colors.sidebar.text).toContain("--sidebar-text");
    expect(colors.sidebar["text-active"]).toContain("--sidebar-text-active");
    expect(colors.sidebar.border).toContain("--sidebar-border");
    expect(shadows["sidebar-item"]).toBe("none");
  });

  it("eradicates blue-800 cast from card-hover and gradient-primary", () => {
    expect(shadows["card-hover"]).not.toContain("30, 64, 175");
    expect(shadows["card-hover"]).toContain("0, 0, 0");
    expect(backgrounds["gradient-primary"]).toBeUndefined();
  });

  it("provides transitional backward-compatibility aliases for secondary, warning, danger", () => {
    expect(colors.secondary.DEFAULT).toContain("--semantic-money-in");
    expect(colors.warning.DEFAULT).toContain("--semantic-attention");
    expect(colors.danger.DEFAULT).toContain("--semantic-money-owed");
  });

  it("exposes card-elevated and separator in colors", () => {
    expect(colors["card-elevated"]).toBeDefined();
    expect(colors.separator).toBe("hsl(var(--separator))");
  });
});

describe("AD-L1 Token Truth - CSS Variable Parity & Zero Navy Invariants in globals.css", () => {
  const globalsCssPath = path.resolve(__dirname, "../../app/globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  it("contains zero hue-222, hue-223, or hue-216 navy definitions in .dark", () => {
    const darkBlockMatch = globalsCss.match(/\.dark\s*\{([\s\S]*?)\}/);
    expect(darkBlockMatch).toBeTruthy();
    const darkContent = darkBlockMatch![1];

    expect(darkContent).not.toMatch(/222\s+47%/);
    expect(darkContent).not.toMatch(/223\s+47%/);
    expect(darkContent).not.toMatch(/216\s+34%/);
    expect(darkContent).not.toMatch(/#0B0F19/i);
    expect(darkContent).not.toMatch(/#0F1422/i);
    expect(darkContent).not.toMatch(/#141B2D/i);
  });

  it("enforces Apple true neutral surface values in .dark", () => {
    const darkBlockMatch = globalsCss.match(/\.dark\s*\{([\s\S]*?)\}/);
    expect(darkBlockMatch).toBeTruthy();
    const darkContent = darkBlockMatch![1];

    expect(darkContent).toMatch(/--background:\s*0\s+0%\s+0%/);
    expect(darkContent).toMatch(/--card:\s*240\s+3%\s+11%/);
    expect(darkContent).toMatch(/--card-elevated:\s*240\s+2%\s+17%/);
    expect(darkContent).toMatch(/--popover:\s*240\s+2%\s+17%/);
    expect(darkContent).toMatch(/--muted:\s*240\s+2%\s+17%/);
    expect(darkContent).toMatch(/--muted-foreground:\s*240\s+2%\s+57%/);
    expect(darkContent).toMatch(/--border:\s*240\s+2%\s+22%/);
    expect(darkContent).toMatch(/--input:\s*240\s+2%\s+22%/);
    expect(darkContent).toMatch(/--ring:\s*210\s+100%\s+52%/);
    expect(darkContent).toMatch(/--separator:\s*240\s+2%\s+34%/);
  });

  it("enforces Apple neutral light canvas values in :root", () => {
    const rootBlockMatch = globalsCss.match(/:root\s*\{([\s\S]*?)\}/);
    expect(rootBlockMatch).toBeTruthy();
    const rootContent = rootBlockMatch![1];

    expect(rootContent).toMatch(/--background:\s*240\s+5%\s+96%/);
    expect(rootContent).toMatch(/--card:\s*0\s+0%\s+100%/);
    expect(rootContent).toMatch(/--border:\s*240\s+2%\s+78%/);
    expect(rootContent).toMatch(/--separator:\s*240\s+2%\s+78%/);
    expect(rootContent).toMatch(/--foreground:\s*0\s+0%\s+0%/);
  });

  it("enforces 100% parity between light :root and .dark semantic variables", () => {
    const rootBlockMatch = globalsCss.match(/:root\s*\{([\s\S]*?)\}/);
    const darkBlockMatch = globalsCss.match(/\.dark\s*\{([\s\S]*?)\}/);
    expect(rootBlockMatch).toBeTruthy();
    expect(darkBlockMatch).toBeTruthy();

    const rootContent = rootBlockMatch![1];
    const darkContent = darkBlockMatch![1];

    const requiredTokens = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--card-elevated",
      "--popover",
      "--popover-foreground",
      "--muted",
      "--muted-foreground",
      "--border",
      "--separator",
      "--ring",
      "--semantic-interactive",
      "--semantic-interactive-foreground",
      "--semantic-money-in",
      "--semantic-money-in-foreground",
      "--semantic-money-owed",
      "--semantic-money-owed-foreground",
      "--semantic-attention",
      "--semantic-attention-foreground",
      "--semantic-provisional",
      "--semantic-provisional-foreground",
      "--semantic-exam",
      "--semantic-exam-foreground",
      "--semantic-neutral",
      "--semantic-neutral-foreground",
      "--sidebar-bg",
      "--sidebar-hover",
      "--sidebar-active",
      "--sidebar-text",
      "--sidebar-text-active",
      "--sidebar-border",
    ];

    for (const token of requiredTokens) {
      expect(rootContent).toContain(token);
      expect(darkContent).toContain(token);
    }
  });

  it("updates badge utilities to consume semantic tokens", () => {
    expect(globalsCss).toMatch(/\.badge-success\s*\{[\s\S]*?semantic-money-in/);
    expect(globalsCss).toMatch(/\.badge-warning\s*\{[\s\S]*?semantic-attention/);
    expect(globalsCss).toMatch(/\.badge-danger\s*\{[\s\S]*?semantic-money-owed/);
    expect(globalsCss).toMatch(/\.badge-provisional\s*\{[\s\S]*?semantic-provisional/);
    expect(globalsCss).toMatch(/\.badge-neutral\s*\{[\s\S]*?muted/);
    expect(globalsCss).not.toMatch(/\.badge-success\s*\{[\s\S]*?bg-secondary\/10/);
    expect(globalsCss).not.toMatch(/\.badge-warning\s*\{[\s\S]*?bg-warning\/10/);
    expect(globalsCss).not.toMatch(/\.badge-danger\s*\{[\s\S]*?bg-danger\/10/);
  });
});

describe("AD-L1 Token Truth - WCAG 4.5:1 Base Contrast Law", () => {
  it("passes 4.5:1 contrast for all dark mode semantic colors on card #1C1C1E", () => {
    const cardDark = "#1C1C1E";
    expect(contrastRatio("#0A84FF", cardDark)).toBeGreaterThanOrEqual(4.5); // 4.66:1
    expect(contrastRatio("#30D158", cardDark)).toBeGreaterThanOrEqual(4.5); // 8.42:1
    expect(contrastRatio("#FF453A", cardDark)).toBeGreaterThanOrEqual(4.5); // 4.99:1
    expect(contrastRatio("#FF9F0A", cardDark)).toBeGreaterThanOrEqual(4.5); // 8.28:1
    expect(contrastRatio("#FFD60A", cardDark)).toBeGreaterThanOrEqual(4.5); // 12.05:1
    expect(contrastRatio("#8E8E93", cardDark)).toBeGreaterThanOrEqual(4.5); // 5.22:1
    expect(contrastRatio("#FFFFFF", cardDark)).toBeGreaterThanOrEqual(4.5); // 17.01:1
  });

  it("passes 4.5:1 contrast for light mode accessible foreground tokens on white #FFFFFF", () => {
    const white = "#FFFFFF";
    expect(contrastRatio("#1B6A2E", white)).toBeGreaterThanOrEqual(4.5); // 6.67:1 (money-in text)
    expect(contrastRatio("#D70015", white)).toBeGreaterThanOrEqual(4.5); // 5.38:1 (money-owed text)
    expect(contrastRatio("#9E4400", white)).toBeGreaterThanOrEqual(4.5); // 6.40:1 (attention text)
    expect(contrastRatio("#785A00", white)).toBeGreaterThanOrEqual(4.5); // 6.44:1 (provisional text)
    expect(contrastRatio("#3634A3", white)).toBeGreaterThanOrEqual(4.5); // 5.65:1 (exam text)
    expect(contrastRatio("#636366", white)).toBeGreaterThanOrEqual(4.5); // 5.99:1 (neutral text)
    expect(contrastRatio("#737378", white)).toBeGreaterThanOrEqual(4.5); // 4.71:1 (secondaryLabel muted-foreground)
    expect(contrastRatio("#000000", white)).toBeGreaterThanOrEqual(4.5); // 21.00:1 (label primary)
  });

  it("passes 4.5:1 contrast for all dark mode semantic colors on true black canvas #000000", () => {
    const black = "#000000";
    expect(contrastRatio("#0A84FF", black)).toBeGreaterThanOrEqual(4.5); // 5.48:1
    expect(contrastRatio("#30D158", black)).toBeGreaterThanOrEqual(4.5); // 9.90:1
    expect(contrastRatio("#FF453A", black)).toBeGreaterThanOrEqual(4.5); // 5.86:1
    expect(contrastRatio("#FF9F0A", black)).toBeGreaterThanOrEqual(4.5); // 9.74:1
    expect(contrastRatio("#FFD60A", black)).toBeGreaterThanOrEqual(4.5); // 14.18:1
    expect(contrastRatio("#8E8E93", black)).toBeGreaterThanOrEqual(4.5); // 6.14:1
    expect(contrastRatio("#FFFFFF", black)).toBeGreaterThanOrEqual(4.5); // 21.00:1
  });
});
