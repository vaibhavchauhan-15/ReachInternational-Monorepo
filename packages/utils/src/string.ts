/**
 * ServiceCentric Shared Utilities — String Formatters
 * Utility functions for string manipulation, entity code formatting, and capitalization.
 */

export function truncate(str: string, maxLength: number = 30): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatMachineCode(code: string | number): string {
  if (!code) return '';
  const str = String(code);
  if (str.startsWith('MCH-')) return str;
  return `MCH-${str.padStart(4, '0')}`;
}

export function formatEmployeeId(id: string | number): string {
  if (!id) return '';
  const str = String(id);
  if (str.startsWith('EMP-')) return str;
  return `EMP-${str.padStart(3, '0')}`;
}

export function formatChallanNumber(num: string | number): string {
  if (!num) return '';
  const str = String(num);
  if (str.startsWith('CHN-')) return str;
  return `CHN-${str.padStart(5, '0')}`;
}

/**
 * Summarizes a task description or instructions into a clean, concise short title (~55 chars max).
 * Automatically strips conversational filler, markdown bullets, list numbers, greeting prefixes,
 * and trailing deadline phrases while preserving machine codes (e.g. EXCA-001).
 */
export function summarizeTaskTitle(description: string): string {
  if (!description || !description.trim()) return '';

  const raw = description.trim();

  // 1. Extract Machine IDs / Codes if present (e.g. EXCA-001, CAT-320, GEN-04, MCH-0012)
  const machineCodeMatch = raw.match(/\b([A-Z]{2,6}-\d{2,5})\b/i);
  const machineCode = machineCodeMatch ? machineCodeMatch[1].toUpperCase() : null;

  // 2. Clean text: strip leading markdown bullet points, list numbers, symbols
  let text = raw
    .replace(/^[\s\*\-\#\>\d\.\:\(\)\[\]\+]+/, '')
    .replace(/\s+/g, ' ');

  // 3. Multi-layer filler prefix removal (case-insensitive)
  const fillerPrefixes = [
    /^(hi|hello|hey|dear|team|all|urgent|important|priority|note|reminder|task|task instructions|action item|service request|work order)[\:\,\-\s]+/i,
    /^(pls|please|kindly|could you|can you|would you|we need to|we should|i need you to|task is to|task to|your task is to|make sure to|ensure that|remember to|request to|is required to|needed to|perform|execute)\s+/i,
    /^(this is a task to|it is necessary to|don't forget to|do not forget to|please make sure to|please ensure that|please kindly)\s+/i,
  ];

  let prevText = '';
  while (text !== prevText) {
    prevText = text;
    for (const regex of fillerPrefixes) {
      text = text.replace(regex, '').trim();
    }
  }

  // 4. Extract primary clause (split by period, exclamation, question mark, newline, or semicolon)
  const clauses = text.split(/(?<=[.?!;\n])\s+/).filter((c) => c.trim().length > 0);
  let mainClause = clauses[0] || text;

  // If first clause is just a greeting/short word (< 8 non-symbol chars), use second clause
  if (clauses.length > 1 && mainClause.replace(/[^a-zA-Z0-9]/g, '').length < 8) {
    mainClause = clauses[1];
  }

  // Strip filler prefixes from chosen main clause again
  for (const regex of fillerPrefixes) {
    mainClause = mainClause.replace(regex, '').trim();
  }

  // 5. Remove trailing time/deadline phrases (e.g. "by end of day", "before 4 PM", "on Friday", "due today")
  mainClause = mainClause
    .replace(/\s+(by|before|on|due|until|asap|end of)\s+(today|tomorrow|yesterday|eod|now|[0-9]{1,2}(:[0-9]{2})?\s*(am|pm)?|[a-z]+day|\d{4}-\d{2}-\d{2})\b.*/i, '')
    .trim();

  // 6. Sentence capitalization
  if (!mainClause) {
    mainClause = raw.slice(0, 50);
  }
  let summarized = mainClause.charAt(0).toUpperCase() + mainClause.slice(1);

  // 7. Neat length truncation (~55 characters maximum)
  const MAX_LEN = 55;
  if (summarized.length > MAX_LEN) {
    let truncated = summarized.substring(0, MAX_LEN - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 20) {
      truncated = truncated.substring(0, lastSpace);
    }
    // Remove dangling prepositions or punctuation
    truncated = truncated.replace(/[\s\-\,\:\;\&\+\/\(\)\.\s]+(on|for|in|at|to|with|and|or|by|of|the|a|an)$/i, '').trim();
    summarized = truncated + '...';
  }

  // 8. If a machine code was found in original description but lost in truncation/clause, append it neatly
  if (machineCode && !summarized.toUpperCase().includes(machineCode)) {
    if (summarized.length + machineCode.length + 3 <= MAX_LEN + 5) {
      summarized = summarized.replace(/\.\.\.$/, '').trim() + ` (${machineCode})`;
    }
  }

  return summarized;
}

