import { Font } from "@react-pdf/renderer";

export const PDF_FONT_FAMILIES = {
  SANS: "NotoSans",
  KANNADA: "NotoSansKannada",
  FALLBACK: "Helvetica",
} as const;

let fontsRegistered = false;

/**
 * Registers Noto Sans and Noto Sans Kannada fonts for @react-pdf/renderer.
 * Safe to call multiple times; never throws if remote/optional font URLs are unavailable.
 */
export function registerPdfFonts(): boolean {
  if (fontsRegistered) {
    return true;
  }

  try {
    Font.register({
      family: PDF_FONT_FAMILIES.SANS,
      fonts: [
        {
          src: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
          fontWeight: "normal",
        },
        {
          src: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
          fontWeight: "bold",
        },
      ],
    });

    Font.register({
      family: PDF_FONT_FAMILIES.KANNADA,
      fonts: [
        {
          src: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansKannada/NotoSansKannada-Regular.ttf",
          fontWeight: "normal",
        },
        {
          src: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansKannada/NotoSansKannada-Bold.ttf",
          fontWeight: "bold",
        },
      ],
    });

    fontsRegistered = true;
    return true;
  } catch {
    // Fallback to built-in Helvetica if font registration fails in offline/sandboxed environments
    return false;
  }
}

// Attempt registration at module load without ever throwing
registerPdfFonts();
