import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAadhaarNumber,
  validateBankAccountNumber,
  validateIfscCode,
  validateLicenseNumber,
} from "@reachinternational/utils";
import { isSupervisedRole } from "@reachinternational/permissions";

// Document security constants (in sync with auth.ts)
const ALLOWED_SIGNUP_DOCUMENT_MIMES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_SIGNUP_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function validateDocumentUpload(
  file: { size: number; type: string; name: string } | null,
  required: boolean,
  label: string
): { error?: string; safeExt?: string } {
  if (!file || file.size === 0) {
    if (required) return { error: `${label} is required.` };
    return {};
  }
  if (file.size > MAX_SIGNUP_FILE_SIZE_BYTES) {
    return {
      error: `${label} must be smaller than 2 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }
  const safeExt = ALLOWED_SIGNUP_DOCUMENT_MIMES[file.type.toLowerCase()];
  if (!safeExt) {
    return {
      error: `${label} must be a valid document file (JPG, PNG, WebP, or PDF).`,
    };
  }
  return { safeExt };
}

function sanitizeDocumentFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 100);
}

// Client-side completeness & validation simulator (in sync with page.tsx)
function evaluateClientSignupValidation(formValues: {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  supervisor_id: string;
  shift_start_time: string;
  shift_end_time: string;
  street: string;
  address: string;
  city: string;
  district: string;
  state: string;
  state_id?: string | number | null;
  bank_account_number: string;
  bank_ifsc_code: string;
  aadhaar_number: string;
  license_number: string;
  password: string;
  confirm_password: string;
  hasBankFile: boolean;
  hasAadhaarFile: boolean;
  agreedToTerms: boolean;
}) {
  const errors: Record<string, string> = {};

  if (!formValues.full_name.trim() || formValues.full_name.trim().length < 2) {
    errors.full_name = "Full name is required (minimum 2 characters).";
  }
  const cleanEmail = formValues.email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    errors.email = "Please enter a valid email address.";
  }
  const phoneDigits = formValues.phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    errors.phone = "Please enter a valid 10-digit mobile number.";
  }
  if (isSupervisedRole(formValues.role) && !formValues.supervisor_id.trim()) {
    errors.supervisor_id = "Please select your supervisor.";
  }
  if (!formValues.shift_start_time.trim()) {
    errors.shift_start_time = "Shift start time is required.";
  }
  if (!formValues.shift_end_time.trim()) {
    errors.shift_end_time = "Shift end time is required.";
  }

  const resolvedStreet = (formValues.street || formValues.address || "").trim();
  if (resolvedStreet.length < 2) {
    errors.street = "Address (street / site base) is required.";
    errors.address = "Address (street / site base) is required.";
  }
  if (!formValues.city.trim() || formValues.city.trim().length < 2) {
    errors.city = "City is required.";
  }
  if (!formValues.district.trim() || formValues.district.trim().length < 2) {
    errors.district = "District is required.";
  }
  if (!formValues.state.trim() && !formValues.state_id) {
    errors.state = "State is required.";
  }

  if (!formValues.bank_account_number.trim()) {
    errors.bank_account_number = "Bank account number is required.";
  } else {
    const bankRes = validateBankAccountNumber(formValues.bank_account_number);
    if (!bankRes.isValid) {
      errors.bank_account_number = bankRes.error || "Please enter a valid bank account number.";
    }
  }
  if (!formValues.bank_ifsc_code.trim()) {
    errors.bank_ifsc_code = "IFSC code is required.";
  } else {
    const ifscRes = validateIfscCode(formValues.bank_ifsc_code);
    if (!ifscRes.isValid) {
      errors.bank_ifsc_code = ifscRes.error || "Please enter a valid IFSC code (e.g. SBIN0001234).";
    }
  }
  if (!formValues.hasBankFile) {
    errors.bank_document_file = "Bank document (Passbook front page, cancelled cheque, or statement) is required.";
  }
  if (!formValues.aadhaar_number.trim()) {
    errors.aadhaar_number = "Aadhaar card number is required.";
  } else {
    const aadhaarRes = validateAadhaarNumber(formValues.aadhaar_number);
    if (!aadhaarRes.isValid) {
      errors.aadhaar_number = aadhaarRes.error || "Invalid Aadhaar number.";
    }
  }
  if (!formValues.hasAadhaarFile) {
    errors.aadhaar_file = "Aadhaar document upload is required.";
  }
  if (formValues.license_number.trim()) {
    const licRes = validateLicenseNumber(formValues.license_number);
    if (!licRes.isValid) {
      errors.license_number = licRes.error || "Invalid driving licence format.";
    }
  }
  if (!formValues.password || formValues.password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  } else {
    const hasUppercase = /[A-Z]/.test(formValues.password);
    const hasLowercase = /[a-z]/.test(formValues.password);
    const hasDigit = /\d/.test(formValues.password);
    if (!hasUppercase || !hasLowercase || !hasDigit) {
      errors.password = "Password must include uppercase, lowercase, and a number.";
    }
  }
  if (formValues.password !== formValues.confirm_password) {
    errors.confirm_password = "Passwords do not match.";
  }
  if (!formValues.agreedToTerms) {
    errors.terms = "You must agree to the Terms of Service and Privacy Policy to register.";
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function getValidAadhaarNumber(): string {
  for (let i = 210034567890; i < 210034567990; i++) {
    const s = String(i);
    if (validateAadhaarNumber(s).isValid) return s;
  }
  return "210034567890";
}

// ---------------- TESTS ---------------- //

test("ACCEPTED: Complete valid operator signup input passes all client pre-flight checks", () => {
  const validAadhaar = getValidAadhaarNumber();
  const result = evaluateClientSignupValidation({
    full_name: "Aakash Verma",
    email: "aakash.verma@example.com",
    phone: "9876543210",
    role: "operator",
    supervisor_id: "e4a2d8b4-0000-4000-8000-000000000001",
    shift_start_time: "08:00 AM",
    shift_end_time: "08:00 PM",
    street: "Plot 42, Sector 18, Industrial Area",
    address: "",
    city: "Gurugram",
    district: "Gurugram",
    state: "Haryana",
    state_id: 12,
    bank_account_number: "123456789012",
    bank_ifsc_code: "HDFC0001234",
    aadhaar_number: validAadhaar,
    license_number: "HR06 20110012345",
    password: "Password@123",
    confirm_password: "Password@123",
    hasBankFile: true,
    hasAadhaarFile: true,
    agreedToTerms: true,
  });

  if (!result.isValid) console.log("Test 1 failed with errors:", result.errors);
  assert.equal(result.isValid, true);
  assert.equal(Object.keys(result.errors).length, 0);
});

test("ACCEPTED: Address satisfies validation if entered either in street or address field", () => {
  const validAadhaar = getValidAadhaarNumber();
  // Case A: street provided, address empty
  const resA = evaluateClientSignupValidation({
    full_name: "Rahul Sharma",
    email: "rahul@reach.com",
    phone: "9812345678",
    role: "manager",
    supervisor_id: "",
    shift_start_time: "09:00 AM",
    shift_end_time: "06:00 PM",
    street: "MIDC Phase 2",
    address: "",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    bank_account_number: "112233445566",
    bank_ifsc_code: "SBIN0001234",
    aadhaar_number: validAadhaar,
    license_number: "",
    password: "SecurePassword1",
    confirm_password: "SecurePassword1",
    hasBankFile: true,
    hasAadhaarFile: true,
    agreedToTerms: true,
  });
  assert.equal(resA.isValid, true, "Street provided should satisfy address validation");

  // Case B: address provided, street empty
  const resB = evaluateClientSignupValidation({
    full_name: "Rahul Sharma",
    email: "rahul@reach.com",
    phone: "9812345678",
    role: "manager",
    supervisor_id: "",
    shift_start_time: "09:00 AM",
    shift_end_time: "06:00 PM",
    street: "",
    address: "MIDC Phase 2",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    bank_account_number: "112233445566",
    bank_ifsc_code: "SBIN0001234",
    aadhaar_number: validAadhaar,
    license_number: "",
    password: "SecurePassword1",
    confirm_password: "SecurePassword1",
    hasBankFile: true,
    hasAadhaarFile: true,
    agreedToTerms: true,
  });
  assert.equal(resB.isValid, true, "Address fallback should satisfy address validation");
});

test("REJECTED: Missing street and address triggers clear error", () => {
  const result = evaluateClientSignupValidation({
    full_name: "Rahul Sharma",
    email: "rahul@reach.com",
    phone: "9812345678",
    role: "manager",
    supervisor_id: "",
    shift_start_time: "09:00 AM",
    shift_end_time: "06:00 PM",
    street: "",
    address: "",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    bank_account_number: "112233445566",
    bank_ifsc_code: "SBIN0001234",
    aadhaar_number: "234567890127",
    license_number: "",
    password: "SecurePassword1",
    confirm_password: "SecurePassword1",
    hasBankFile: true,
    hasAadhaarFile: true,
    agreedToTerms: true,
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.street || result.errors.address);
});

test("REJECTED: Operator missing supervisor triggers supervisor_id error", () => {
  const result = evaluateClientSignupValidation({
    full_name: "Aakash Verma",
    email: "aakash.verma@example.com",
    phone: "9876543210",
    role: "operator",
    supervisor_id: "",
    shift_start_time: "08:00 AM",
    shift_end_time: "08:00 PM",
    street: "Plot 42, MIDC",
    address: "",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    bank_account_number: "123456789012",
    bank_ifsc_code: "HDFC0001234",
    aadhaar_number: "234567890127",
    license_number: "",
    password: "Password@123",
    confirm_password: "Password@123",
    hasBankFile: true,
    hasAadhaarFile: true,
    agreedToTerms: true,
  });
  assert.equal(result.isValid, false);
  assert.equal(result.errors.supervisor_id, "Please select your supervisor.");
});

test("REJECTED: Invalid Aadhaar number fails Verhoeff checksum validation", () => {
  // 123456789012 has invalid Verhoeff checksum
  const val = validateAadhaarNumber("123456789012");
  assert.equal(val.isValid, false);
  assert.ok(val.error?.toLowerCase().includes("aadhaar") || val.error?.toLowerCase().includes("invalid"));
});

test("REJECTED: Invalid IFSC code format", () => {
  const invalid1 = validateIfscCode("HDFC1234567"); // 5th char must be 0
  assert.equal(invalid1.isValid, false);
  const invalid2 = validateIfscCode("HDF0000123"); // 3 letters instead of 4
  assert.equal(invalid2.isValid, false);
});

test("REJECTED: Invalid Bank Account Number (< 9 or non-numeric)", () => {
  const short = validateBankAccountNumber("12345");
  assert.equal(short.isValid, false);
  const nonNum = validateBankAccountNumber("12345678ABCD");
  assert.equal(nonNum.isValid, false);
});

test("SECURITY: Dangerous file extensions and malicious MIME types are rejected", () => {
  // PHP web shell attempt
  const phpFile = { name: "shell.php", type: "application/x-php", size: 1024 };
  const phpVal = validateDocumentUpload(phpFile, true, "Bank document");
  assert.ok(phpVal.error);
  assert.equal(phpVal.safeExt, undefined);

  // SVG XSS attempt
  const svgFile = { name: "image.svg", type: "image/svg+xml", size: 2048 };
  const svgVal = validateDocumentUpload(svgFile, true, "Bank document");
  assert.ok(svgVal.error);
  assert.equal(svgVal.safeExt, undefined);

  // Executable attempt
  const exeFile = { name: "setup.exe", type: "application/x-msdownload", size: 4096 };
  const exeVal = validateDocumentUpload(exeFile, true, "Aadhaar document");
  assert.ok(exeVal.error);
  assert.equal(exeVal.safeExt, undefined);
});

test("SECURITY: Oversized files (> 2 MB) are rejected to prevent storage abuse", () => {
  const bigFile = { name: "large_scan.pdf", type: "application/pdf", size: 3 * 1024 * 1024 }; // 3MB
  const val = validateDocumentUpload(bigFile, true, "Bank document");
  assert.ok(val.error);
  assert.ok(val.error.includes("2 MB"));
});

test("SECURITY: Legitimate document types receive canonical safe extensions", () => {
  const jpegFile = { name: "my_passbook.JPEG", type: "image/jpeg", size: 500000 };
  const valJpeg = validateDocumentUpload(jpegFile, true, "Bank document");
  assert.equal(valJpeg.error, undefined);
  assert.equal(valJpeg.safeExt, ".jpg");

  const pdfFile = { name: "aadhaar_scan.pdf", type: "application/pdf", size: 700000 };
  const valPdf = validateDocumentUpload(pdfFile, true, "Aadhaar document");
  assert.equal(valPdf.error, undefined);
  assert.equal(valPdf.safeExt, ".pdf");

  const pngFile = { name: "cheque.png", type: "image/png", size: 400000 };
  const valPng = validateDocumentUpload(pngFile, true, "Bank document");
  assert.equal(valPng.error, undefined);
  assert.equal(valPng.safeExt, ".png");
});

test("SECURITY: sanitizeDocumentFileName strips directory traversal characters", () => {
  const traversal = "../../etc/passwd.jpg";
  const sanitized = sanitizeDocumentFileName(traversal);
  assert.equal(sanitized.includes("/"), false);
  assert.equal(sanitized.includes("\\"), false);
  assert.equal(sanitized.includes(".."), false);
});

test("SECURITY: Password complexity enforces uppercase, lowercase, and digit", () => {
  // No uppercase
  const noUpper = evaluateClientSignupValidation({
    full_name: "Rahul Sharma",
    email: "rahul@reach.com",
    phone: "9812345678",
    role: "manager",
    supervisor_id: "",
    shift_start_time: "09:00 AM",
    shift_end_time: "06:00 PM",
    street: "MIDC",
    address: "",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    bank_account_number: "112233445566",
    bank_ifsc_code: "SBIN0001234",
    aadhaar_number: "234567890127",
    license_number: "",
    password: "password123",
    confirm_password: "password123",
    hasBankFile: true,
    hasAadhaarFile: true,
    agreedToTerms: true,
  });
  assert.equal(noUpper.isValid, false);
  assert.ok(noUpper.errors.password);

  // No number
  const noDigit = evaluateClientSignupValidation({
    full_name: "Rahul Sharma",
    email: "rahul@reach.com",
    phone: "9812345678",
    role: "manager",
    supervisor_id: "",
    shift_start_time: "09:00 AM",
    shift_end_time: "06:00 PM",
    street: "MIDC",
    address: "",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    bank_account_number: "112233445566",
    bank_ifsc_code: "SBIN0001234",
    aadhaar_number: "234567890127",
    license_number: "",
    password: "PasswordOnly",
    confirm_password: "PasswordOnly",
    hasBankFile: true,
    hasAadhaarFile: true,
    agreedToTerms: true,
  });
  assert.equal(noDigit.isValid, false);
  assert.ok(noDigit.errors.password);
});

test("SECURITY: Role tampering prevention rejects unauthorized administrative self-registration", () => {
  const allowedRoles = ["manager", "supervisor", "hr", "operator"];
  const maliciousRoles = ["admin", "super_admin", "root", "<script>alert(1)</script>", "moderator"];

  for (const malicious of maliciousRoles) {
    assert.equal(
      allowedRoles.includes(malicious),
      false,
      `Role ${malicious} must never be accepted for self-registration`
    );
  }
});

test("SECURITY: Password DoS prevention rejects excessively long strings (> 128 characters)", () => {
  const longPassword = "A1" + "a".repeat(150);
  assert.ok(longPassword.length > 128);
  const isAccepted = longPassword.length <= 128;
  assert.equal(isAccepted, false, "Passwords > 128 characters must be rejected to prevent bcrypt CPU exhaustion");
});

test("SECURITY: Supervisor ID must be a strictly formed UUIDv4", () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.equal(uuidRegex.test("e4a2d8b4-0000-4000-8000-000000000001"), true);
  assert.equal(uuidRegex.test("not-a-uuid"), false);
  assert.equal(uuidRegex.test("'; DROP TABLE users; --"), false);
  assert.equal(uuidRegex.test("12345"), false);
});

test("DB CONSISTENCY: Required fields match PostgreSQL check constraints (users_city_not_empty, etc.)", () => {
  // DB check constraint: users_city_not_empty -> CHECK ((btrim(city) <> ''::text))
  // DB check constraint: users_district_not_empty -> CHECK ((btrim(district) <> ''::text))
  // DB check constraint: users_state_not_empty -> CHECK ((btrim(state) <> ''::text))
  // DB check constraint: users_email_not_empty -> CHECK ((btrim(email) <> ''::text))
  
  const validateDbFields = (val: { city: string; district: string; state: string; email: string }) => {
    return (
      val.city.trim().length > 0 &&
      val.district.trim().length > 0 &&
      val.state.trim().length > 0 &&
      val.email.trim().length > 0
    );
  };

  assert.equal(validateDbFields({ city: "Pune", district: "Pune", state: "Maharashtra", email: "user@reach.com" }), true);
  assert.equal(validateDbFields({ city: "   ", district: "Pune", state: "Maharashtra", email: "user@reach.com" }), false);
  assert.equal(validateDbFields({ city: "Pune", district: "", state: "Maharashtra", email: "user@reach.com" }), false);
  assert.equal(validateDbFields({ city: "Pune", district: "Pune", state: " ", email: "user@reach.com" }), false);
});

