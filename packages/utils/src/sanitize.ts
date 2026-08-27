/**
 * ReachInternational — Robust Client & Server Safe HTML Sanitizer
 *
 * Sanitizes untrusted HTML strings by stripping dangerous tags, inline event handlers,
 * pseudo-protocol URIs (javascript:, vbscript:, data:text/html), and style expressions,
 * while preserving safe HTML structure used in email templates and dashboards.
 */

// Disallowed HTML tags whose entire block (including contents) must be stripped
const BLOCKED_BLOCK_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "form",
  "textarea",
  "button",
  "select",
  "option",
  "noscript",
];

// Disallowed standalone/void tags
const BLOCKED_VOID_TAGS = [
  "base",
  "link",
  "meta",
  "input",
  "frame",
  "frameset",
];

/**
 * Sanitizes an untrusted HTML string to prevent Cross-Site Scripting (XSS) and injection attacks.
 *
 * @param rawHtml - Raw HTML string to sanitize
 * @returns Clean, safe HTML string safe for DOM rendering
 */
export function sanitizeHtml(rawHtml: unknown): string {
  if (rawHtml === null || rawHtml === undefined) {
    return "";
  }

  let html = String(rawHtml);

  // 1. Remove comments
  html = html.replace(/<!--[\s\S]*?-->/gi, "");

  // 2. Remove blocked tags and their contents
  for (const tag of BLOCKED_BLOCK_TAGS) {
    const blockRegex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    html = html.replace(blockRegex, "");
    // Also remove unclosed opening tags
    const unclosedRegex = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    html = html.replace(unclosedRegex, "");
  }

  // 3. Remove blocked void tags
  for (const tag of BLOCKED_VOID_TAGS) {
    const voidRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    html = html.replace(voidRegex, "");
  }

  // 4. Strip all inline DOM event handlers (e.g., onload, onerror, onclick, onmouseover, etc.)
  // Matches: on[a-zA-Z]+ = "..." or '...' or unquoted
  html = html.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 5. Neutralize dangerous URL protocols in attributes (href, src, formaction, etc.)
  // e.g. href="javascript:alert(1)" -> href="#blocked"
  html = html.replace(
    /\b(href|src|action|formaction|poster|background|data)\s*=\s*(["'])([\s\S]*?)\2/gi,
    (match, attr, quote, val) => {
      const cleanVal = val.trim().toLowerCase().replace(/[\u0000-\u001F\u007F-\u009F\s]/g, "");
      if (
        cleanVal.startsWith("javascript:") ||
        cleanVal.startsWith("vbscript:") ||
        cleanVal.startsWith("data:text/html") ||
        cleanVal.startsWith("data:text/javascript") ||
        cleanVal.startsWith("data:application/javascript")
      ) {
        return `${attr}=${quote}#blocked${quote}`;
      }
      return match;
    }
  );

  // 6. Neutralize dangerous CSS in style attributes (e.g., style="background: url('javascript:...')", style="behavior:...", expression(...))
  html = html.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi, (match, quote, styleContent) => {
    const lower = styleContent.toLowerCase();
    if (
      lower.includes("javascript:") ||
      lower.includes("vbscript:") ||
      lower.includes("expression(") ||
      lower.includes("-moz-binding") ||
      lower.includes("behavior:")
    ) {
      return "";
    }
    return match;
  });

  return html.trim();
}
