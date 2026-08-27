/**
 * Server-Side Template Injection (SSTI) Defense & Safe Output Encoding Utility
 *
 * Provides safe, non-evaluating string parameter substitution and HTML entity escaping
 * to protect against SSTI, dynamic code execution, and unescaped HTML injection.
 */

// HTML entity replacement map
const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#47;',
  '`': '&#96;',
};

/**
 * Encodes special HTML characters in a string or value to prevent HTML injection & SSTI.
 * Returns an empty string for null or undefined inputs.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  return str.replace(/[&<>"'/`]/g, (char) => HTML_ENTITY_MAP[char] || char);
}

export interface RenderSafeTemplateOptions {
  /**
   * Whether to automatically HTML-escape inserted parameter values.
   * Default: false (set to true when generating raw HTML strings)
   */
  escapeValues?: boolean;

  /**
   * String to insert when a placeholder key is not present in params.
   * Default: ''
   */
  fallbackValue?: string;
}

/**
 * Safely renders a template string by performing a single-pass, static placeholder
 * substitution for `{{key}}` or `{{ key }}` patterns.
 *
 * Security Guarantees:
 * 1. Zero Expression Evaluation: Rejects evaluating math (`7 * 7`), JS code, or object paths (`process.env`).
 * 2. Single-Pass Non-Recursive Substitution: Values inserted into the template are NEVER re-scanned,
 *    preventing double-evaluation / nested template injection attacks.
 * 3. HTML Escaping: When `options.escapeValues` is true, values are HTML-encoded via `escapeHtml()`.
 */
export function renderSafeTemplate(
  template: string,
  params: Record<string, unknown> = {},
  options: RenderSafeTemplateOptions = {}
): string {
  if (!template) return '';

  const escapeValues = options.escapeValues ?? false;
  const fallback = options.fallbackValue;

  // Single-pass replacement using non-greedy regex targeting {{ key }} or {{key}}
  return template.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const rawVal = params[key];
      if (rawVal === null || rawVal === undefined) {
        return fallback !== undefined ? fallback : '';
      }
      const valStr = String(rawVal);
      return escapeValues ? escapeHtml(valStr) : valStr;
    }
    return fallback !== undefined ? fallback : match;
  });
}
