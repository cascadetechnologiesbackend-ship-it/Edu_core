import enMessages from "../messages/en.json";
import hiMessages from "../messages/hi.json";

export type SupportedLocale = "en" | "hi";

export function getParentMessages(locale: string = "en") {
  return locale === "hi" ? hiMessages : enMessages;
}

/**
 * Replaces {variable} placeholders in translation strings.
 */
export function formatI18nString(
  template: string,
  variables: Record<string, string | number> = {}
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }
  return result;
}
