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

// ---------------------------------------------------------------------------
// Indian Regulatory Identity Validation (Aadhaar & Driving Licence)
// ---------------------------------------------------------------------------

// Verhoeff Algorithm Tables (D5 Dihedral Group Checksum for Aadhaar Validation)
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validates a number string using the Verhoeff checksum algorithm (used by UIDAI Aadhaar).
 */
export function validateVerhoeff(numStr: string): boolean {
  if (!/^\d+$/.test(numStr)) return false;
  let c = 0;
  const digits = numStr.split("").map(Number).reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  return c === 0;
}

export interface AadhaarValidationResult {
  isValid: boolean;
  error?: string;
  clean?: string;
  formatted?: string;
}

/**
 * Validates an Indian Aadhaar Card number:
 * 1. Must contain exactly 12 digits (ignoring spaces/hyphens).
 * 2. Cannot start with 0 or 1 (UIDAI standard).
 * 3. Cannot consist of all repeating identical digits (e.g. 222222222222).
 * 4. Must satisfy the Verhoeff mathematical checksum algorithm.
 */
export function validateAadhaarNumber(aadhaar?: string | null): AadhaarValidationResult {
  if (!aadhaar || !aadhaar.trim()) {
    return { isValid: true, clean: "", formatted: "" };
  }

  const raw = aadhaar.trim();
  const clean = raw.replace(/[\s\-]/g, "");

  if (!/^\d+$/.test(clean)) {
    return {
      isValid: false,
      error: "Aadhaar number must contain digits only.",
      clean,
    };
  }

  if (clean.length !== 12) {
    return {
      isValid: false,
      error: `Aadhaar number must be exactly 12 digits (entered ${clean.length} digits).`,
      clean,
    };
  }

  if (clean.startsWith("0") || clean.startsWith("1")) {
    return {
      isValid: false,
      error: "Aadhaar number cannot start with 0 or 1.",
      clean,
    };
  }

  // Reject dummy repeating digits like 222222222222, 333333333333, etc.
  if (/^(\d)\1{11}$/.test(clean)) {
    return {
      isValid: false,
      error: "Invalid Aadhaar number (cannot be a repeated single digit).",
      clean,
    };
  }

  if (!validateVerhoeff(clean)) {
    return {
      isValid: false,
      error: "Invalid Aadhaar number (checksum validation failed).",
      clean,
    };
  }

  // Format as 1234 5678 9012
  const formatted = `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;

  return {
    isValid: true,
    clean,
    formatted,
  };
}

/**
 * Quick boolean helper to check if an Aadhaar number is valid.
 */
export function isValidAadhaar(aadhaar?: string | null): boolean {
  return validateAadhaarNumber(aadhaar).isValid;
}

/**
 * Formats a 12-digit Aadhaar number with standard 4-digit space groupings (e.g. 1234 5678 9012).
 */
export function formatAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return "";
  const clean = aadhaar.replace(/\D/g, "").slice(0, 12);
  if (!clean) return "";
  const parts = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join(" ");
}

/**
 * Masks an Aadhaar number to show only the last 4 digits (e.g. XXXX-XXXX-1234)
 * complying with AI/RULES/DATA-PROTECTION-PRIVACY.md.
 */
export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar || !aadhaar.trim()) return "—";
  const clean = aadhaar.replace(/[^0-9]/g, "");
  if (clean.length < 4) return aadhaar.trim();
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

// List of all 36 Indian State and Union Territory 2-letter RTO codes (MoRTH Sarathi)
export const INDIAN_STATE_CODES = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DH", "DL",
  "DN", "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA",
  "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR", "PB",
  "PY", "RJ", "SK", "TN", "TR", "TS", "UA", "UK", "UP", "WB",
]);

export interface LicenseValidationResult {
  isValid: boolean;
  error?: string;
  clean?: string;
  formatted?: string;
}

/**
 * Validates an Indian Driving Licence (DL) number according to MoRTH / Sarathi standards:
 * Standard Format: SS-RR-YYYYNNNNNNN or SS RRYYYYNNNNNNN or SSRRYYYYNNNNNNN
 * 1. Must start with a valid 2-letter Indian State / UT code (e.g., MH, DL, KA, UP, HR).
 * 2. Total clean alphanumeric length must be between 9 and 20 characters (standard modern is 15-16 chars).
 * 3. Must contain valid RTO digits and unique alphanumeric identifier.
 */
export function validateLicenseNumber(license?: string | null): LicenseValidationResult {
  if (!license || !license.trim()) {
    return { isValid: true, clean: "", formatted: "" };
  }

  const raw = license.trim().toUpperCase();
  const clean = raw.replace(/[\s\-\/\.]/g, "");

  if (clean.length < 9 || clean.length > 20) {
    return {
      isValid: false,
      error: `Driving licence number must be between 9 and 20 characters (e.g. MH12 20110012345).`,
      clean,
    };
  }

  const stateCode = clean.slice(0, 2);
  if (!INDIAN_STATE_CODES.has(stateCode)) {
    return {
      isValid: false,
      error: `Invalid state code "${stateCode}". Driving licence must start with a valid 2-letter state code (e.g. MH, DL, KA, UP, HR, GJ).`,
      clean,
    };
  }

  // Must contain alphanumeric characters only
  if (!/^[A-Z0-9]+$/.test(clean)) {
    return {
      isValid: false,
      error: "Driving licence number must contain only letters, numbers, and standard separators.",
      clean,
    };
  }

  // Check that after state code, there are digits
  const rtoCode = clean.slice(2, 4);
  if (!/^\d{2}$/.test(rtoCode) && !/^\d[A-Z0-9]$/.test(rtoCode)) {
    return {
      isValid: false,
      error: "Invalid driving licence format. RTO code following state prefix must be numeric (e.g. MH12...).",
      clean,
    };
  }

  // Format neatly as SS-RR YYYYNNNNNNN or SS-RR-YYYY-NNNNNNN if standard 15-char Sarathi format
  let formatted = raw;
  if (/^[A-Z]{2}\d{13}$/.test(clean)) {
    formatted = `${clean.slice(0, 2)}${clean.slice(2, 4)} ${clean.slice(4, 8)}${clean.slice(8)}`;
  } else if (/^[A-Z]{2}\d{2}/.test(clean)) {
    formatted = `${clean.slice(0, 2)}${clean.slice(2, 4)} ${clean.slice(4)}`;
  }

  return {
    isValid: true,
    clean,
    formatted,
  };
}

/**
 * Quick boolean helper to check if a driving licence number is valid.
 */
export function isValidLicense(license?: string | null): boolean {
  return validateLicenseNumber(license).isValid;
}

/**
 * Formats a driving licence number neatly (e.g. MH12 20110012345).
 */
export function formatLicenseNumber(lic?: string | null): string {
  if (!lic || !lic.trim()) return "—";
  const result = validateLicenseNumber(lic);
  return result.formatted || lic.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Indian Banking Validation (Bank Account Number & RBI IFSC Code)
// ---------------------------------------------------------------------------

export interface BankAccountValidationResult {
  isValid: boolean;
  error?: string;
  clean?: string;
}

/**
 * Validates an Indian Bank Account Number:
 * 1. Must be between 9 and 18 digits (standard Indian banking system range).
 * 2. Digits only, ignoring spaces and hyphens.
 * 3. Cannot consist entirely of zeros or single repeated digits.
 */
export function validateBankAccountNumber(account?: string | null): BankAccountValidationResult {
  if (!account || !account.trim()) {
    return { isValid: false, error: "Bank account number is required." };
  }

  const raw = account.trim();
  const clean = raw.replace(/[\s\-]/g, "");

  if (!/^\d+$/.test(clean)) {
    return {
      isValid: false,
      error: "Bank account number must contain digits only.",
      clean,
    };
  }

  if (clean.length < 9 || clean.length > 18) {
    return {
      isValid: false,
      error: `Bank account number must be between 9 and 18 digits (entered ${clean.length} digits).`,
      clean,
    };
  }

  // Reject repeating single digits like 000000000, 111111111, etc.
  if (/^(\d)\1{8,}$/.test(clean)) {
    return {
      isValid: false,
      error: "Invalid bank account number (cannot consist of repeating identical digits).",
      clean,
    };
  }

  return {
    isValid: true,
    clean,
  };
}

export function isValidBankAccount(account?: string | null): boolean {
  return validateBankAccountNumber(account).isValid;
}

/**
 * Masks a bank account number showing only the last 4 digits (e.g. ••••••••1234).
 */
export function maskBankAccount(account?: string | null): string {
  if (!account || !account.trim()) return "—";
  const clean = account.replace(/\D/g, "");
  if (clean.length < 4) return account.trim();
  return `••••••••${clean.slice(-4)}`;
}

export interface IfscValidationResult {
  isValid: boolean;
  error?: string;
  clean?: string;
}

/**
 * Validates an Indian Financial System Code (IFSC) according to RBI standards:
 * Standard Format: 11 characters alphanumeric
 * 1. First 4 characters: Alphabetic characters representing the bank code.
 * 2. 5th character: Always '0' (reserved for future use).
 * 3. Last 6 characters: Alphanumeric characters representing the specific branch.
 * Example: SBIN0001234, HDFC0000128, ICIC0000002, PUNB0123400
 */
export function validateIfscCode(ifsc?: string | null): IfscValidationResult {
  if (!ifsc || !ifsc.trim()) {
    return { isValid: false, error: "IFSC code is required." };
  }

  const clean = ifsc.trim().toUpperCase().replace(/[\s\-]/g, "");

  if (clean.length !== 11) {
    return {
      isValid: false,
      error: `IFSC code must be exactly 11 characters (entered ${clean.length} characters).`,
      clean,
    };
  }

  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(clean)) {
    if (!/^[A-Z]{4}/.test(clean)) {
      return {
        isValid: false,
        error: "First 4 characters of IFSC code must be alphabetic bank code (e.g. SBIN, HDFC, ICIC).",
        clean,
      };
    }
    if (clean[4] !== "0") {
      return {
        isValid: false,
        error: "5th character of IFSC code must be zero '0'.",
        clean,
      };
    }
    return {
      isValid: false,
      error: "Invalid IFSC code format. Example: SBIN0001234 or HDFC0000128.",
      clean,
    };
  }

  return {
    isValid: true,
    clean,
  };
}

export function isValidIfsc(ifsc?: string | null): boolean {
  return validateIfscCode(ifsc).isValid;
}

export function formatIfscCode(ifsc?: string | null): string {
  if (!ifsc) return "";
  return ifsc.trim().toUpperCase().replace(/[\s\-]/g, "");
}

/**
 * Normalizes client site addresses into their canonical primary site representation.
 * Handles both full postal strings (e.g. "BKC Plot C-26, Bandra East, Mumbai, Mumbai City, Maharashtra, 400051")
 * and short street addresses (e.g. "BKC Plot C-26, Bandra East") to ensure exact equality matching
 * without substring or regex searches.
 */
export function normalizeClientSiteAddress(
  site?: string | null,
  clientStreet?: string | null
): string {
  if (!site) return "";
  const trimmed = site.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return "";

  // If a client registered street is known and the site string starts with it, return the exact street
  if (clientStreet && clientStreet.trim()) {
    const streetClean = clientStreet.trim();
    if (trimmed.toLowerCase().startsWith(streetClean.toLowerCase())) {
      return streetClean;
    }
  }

  // If passed a comma-separated address ending with postal information (pincode/city/state),
  // strip standard trailing postal elements to extract the canonical site street
  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    // If last part is a 6-digit pin code or string has 4+ postal segments
    if (/^\d{6}$/.test(lastPart) || parts.length >= 4) {
      return `${parts[0]}, ${parts[1]}`;
    }
  }

  return trimmed;
}

/**
 * Returns distinct candidate site strings for exact b-tree equality matching.
 * Produces an array of canonical variations (e.g. [rawSite, canonicalSite, clientStreet])
 * eliminating the need for slow ILIKE '%...%' substring scans.
 */
export function resolveSiteMatchCandidates(
  site?: string | null,
  clientStreet?: string | null
): string[] {
  if (!site || site.toLowerCase() === "all") return [];
  const normalized = normalizeClientSiteAddress(site, clientStreet);
  const candidates = new Set<string>();
  if (site.trim()) candidates.add(site.trim());
  if (normalized) candidates.add(normalized);
  if (clientStreet && clientStreet.trim()) candidates.add(clientStreet.trim());
  return Array.from(candidates);
}


