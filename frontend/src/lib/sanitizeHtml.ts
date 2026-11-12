import DOMPurify from "dompurify";

const DANGEROUS_TAGS_RE =
  /<\s*(script|style|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|link|meta|base)\b[^>]*\/?>/gi;

const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URI_RE =
  /(href|src|xlink:href|action|formaction)\s*=\s*(["'])\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"']*\2/gi;
const DANGEROUS_UNQUOTED_URI_RE =
  /(href|src|xlink:href|action|formaction)\s*=\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^\s>]*/gi;

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "span",
  "div",
  "hr",
]);

/**
 * Sanitizes untrusted HTML strings cleanly in both browser (DOMPurify)
 * and Next.js Server Component / SSR environments (strict tag + URI allowlist).
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";

  if (typeof window !== "undefined" && typeof DOMPurify?.sanitize === "function") {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: Array.from(ALLOWED_TAGS),
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
      ALLOW_DATA_ATTR: false,
    });
  }

  // Server-side deterministic sanitization without jsdom SSR bloat
  let cleaned = dirty
    .replace(DANGEROUS_TAGS_RE, "")
    .replace(EVENT_HANDLER_RE, "")
    .replace(DANGEROUS_URI_RE, '$1="#"')
    .replace(DANGEROUS_UNQUOTED_URI_RE, '$1="#"');

  // Strip any remaining non-allowlisted HTML tags while keeping inner text
  cleaned = cleaned.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagName: string, attrs: string) => {
    const lower = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(lower)) {
      return "";
    }
    if (match.startsWith("</")) {
      return `</${lower}>`;
    }
    if (lower === "a") {
      const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const rawHref = (hrefMatch?.[1] || hrefMatch?.[2] || "").trim();
      const safeHref =
        rawHref.startsWith("https://") ||
        rawHref.startsWith("http://") ||
        rawHref.startsWith("/") ||
        rawHref.startsWith("#")
          ? rawHref.replace(/"/g, "&quot;")
          : "#";
      return `<a href="${safeHref}" rel="noopener noreferrer">`;
    }
    if (lower === "br" || lower === "hr") {
      return `<${lower} />`;
    }
    return `<${lower}>`;
  });

  return cleaned;
}

