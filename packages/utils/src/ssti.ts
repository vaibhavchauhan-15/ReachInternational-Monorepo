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

