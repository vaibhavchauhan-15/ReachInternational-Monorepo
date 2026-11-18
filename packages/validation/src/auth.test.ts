import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSignupFormData,
  isSignupSection5Complete,
  SignupSchema,
  CreateUserSchema,
  UpdateUserSchema,
  OnboardingProfileSchema,
} from "./auth.ts";

const baseValidFields = {
  fullName: "Rajesh Kumar",
  email: "rajesh.kumar@reachinternational.in",
  phone: "9876543210",
  shiftStartTime: "08:00 AM",
  shiftEndTime: "08:00 PM",
  street: "Plot 42, MIDC Industrial Area",
  city: "Pune",
  district: "Pune",
  state: "Maharashtra",
  stateId: 27,
  bankAccountNumber: "123456789012",
  bankIfscCode: "HDFC0001234",
  hasBankDoc: true,
  aadhaarNumber: "5161 4022 1953",
  hasAadhaarDoc: true,
  password: "Password@123",
  confirmPassword: "Password@123",
  agreedToTerms: true,
};

test("validateSignupFormData: Operator requires driving licence number and document", () => {
  // Missing both license number and document
  const res1 = validateSignupFormData({
    ...baseValidFields,
    role: "operator",
    supervisorId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    machineCategory: "Forklift",
    licenseNumber: "",
    hasLicenseDoc: false,
  });
  assert.equal(res1.isValid, false);
  assert.equal(res1.errors.license_number, "Driving licence is required for operators");
  assert.equal(res1.errors.license_doc, "Licence document required for operators");

  // Invalid license number format
  const res2 = validateSignupFormData({
    ...baseValidFields,
    role: "operator",
    supervisorId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    machineCategory: "Forklift",
    licenseNumber: "123",
    hasLicenseDoc: true,
  });
  assert.equal(res2.isValid, false);
  assert.ok(res2.errors.license_number, "Should have license format error");

  // Valid license number and document ready
  const res3 = validateSignupFormData({
    ...baseValidFields,
    role: "operator",
    supervisorId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    machineCategory: "Forklift",
    licenseNumber: "MH12 20110012345",
    hasLicenseDoc: true,
  });
  assert.equal(res3.isValid, true);
  assert.deepEqual(res3.errors, {});
});

test("validateSignupFormData: Non-operators (manager, supervisor, hr) DO NOT require driving licence and have ZERO unwanted errors", () => {
  for (const role of ["manager", "supervisor", "hr"]) {
    const res = validateSignupFormData({
      ...baseValidFields,
      role,
      licenseNumber: "",
      hasLicenseDoc: false,
    });
    assert.equal(res.isValid, true, `Role ${role} should be valid without driving licence`);
    assert.equal(res.errors.license_doc, undefined, `Role ${role} must not have license_doc error`);
    assert.equal(res.errors.license_number, undefined, `Role ${role} must not have license_number error`);
  }
});

test("isSignupSection5Complete: Operator vs Non-Operator invariants", () => {
  // Operator: fails when licence number or doc is missing
  assert.equal(
    isSignupSection5Complete({
      role: "operator",
      aadhaar_number: "516140221953",
      has_aadhaar_doc: true,
      license_number: "",
      has_license_doc: false,
    }),
    false
  );

  assert.equal(
    isSignupSection5Complete({
      role: "operator",
      aadhaar_number: "516140221953",
      has_aadhaar_doc: true,
      license_number: "MH12 20110012345",
      has_license_doc: false,
    }),
    false
  );

  assert.equal(
    isSignupSection5Complete({
      role: "operator",
      aadhaar_number: "516140221953",
      has_aadhaar_doc: true,
      license_number: "MH12 20110012345",
      has_license_doc: true,
    }),
    true
  );

  // Non-Operator: completes with Aadhaar only
  for (const role of ["manager", "supervisor", "hr"]) {
    assert.equal(
      isSignupSection5Complete({
        role,
        aadhaar_number: "516140221953",
        has_aadhaar_doc: true,
        license_number: null,
        has_license_doc: false,
      }),
      true,
      `Section 5 should be complete for ${role} with only Aadhaar`
    );
  }
});

test("SignupSchema: Enforces driving licence only for operator", () => {
  const baseSchemaInput = {
    full_name: "Rajesh Kumar",
    email: "rajesh.kumar@reachinternational.in",
    password: "Password@123",
    phone: "9876543210",
    street: "Plot 42, MIDC",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    shift_start_time: "08:00 AM",
    shift_end_time: "08:00 PM",
    bank_account_number: "123456789012",
    bank_ifsc_code: "HDFC0001234",
    aadhaar_number: "5161 4022 1953",
  };

  // Operator without license_number fails
  const opFail = SignupSchema.safeParse({
    ...baseSchemaInput,
    role: "operator",
    supervisor_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    machine_category: "Forklift",
    license_number: "",
  });
  assert.equal(opFail.success, false);
  assert.ok(opFail.error.issues.some((i) => i.path.includes("license_number")));

  // Operator with valid license_number succeeds
  const opPass = SignupSchema.safeParse({
    ...baseSchemaInput,
    role: "operator",
    supervisor_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    machine_category: "Forklift",
    license_number: "MH12 20110012345",
  });
  assert.equal(opPass.success, true);

  // Manager without license_number succeeds
  const mgrPass = SignupSchema.safeParse({
    ...baseSchemaInput,
    role: "manager",
    license_number: "",
  });
  assert.equal(mgrPass.success, true);
});

test("CreateUserSchema & UpdateUserSchema: Enforces driving licence for operator only", () => {
  const baseInput = {
    full_name: "Rajesh Kumar",
    email: "rajesh.kumar@reachinternational.in",
    password: "Password@123",
    phone: "9876543210",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    monthly_salary: 25000,
    machine_category: "Forklift",
  };

  // Create: Operator without licence fails
  const opCreateFail = CreateUserSchema.safeParse({
    ...baseInput,
    role: "operator",
    license_number: "",
  });
  assert.equal(opCreateFail.success, false);
  assert.ok(opCreateFail.error.issues.some((i) => i.path.includes("license_number")));

  // Create: Manager without licence succeeds
  const mgrCreatePass = CreateUserSchema.safeParse({
    ...baseInput,
    role: "manager",
    license_number: "",
  });
  assert.equal(mgrCreatePass.success, true);

  // Update: Operator without licence fails
  const opUpdateFail = UpdateUserSchema.safeParse({
    full_name: "Rajesh Kumar",
    phone: "9876543210",
    role: "operator",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    monthly_salary: 25000,
    machine_category: "Forklift",
    license_number: "",
  });
  assert.equal(opUpdateFail.success, false);
  assert.ok(opUpdateFail.error.issues.some((i) => i.path.includes("license_number")));

  // Update: Manager without licence succeeds
  const mgrUpdatePass = UpdateUserSchema.safeParse({
    full_name: "Rajesh Kumar",
    phone: "9876543210",
    role: "manager",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    license_number: "",
  });
  assert.equal(mgrUpdatePass.success, true);
});

test("OnboardingProfileSchema: Enforces driving licence for operator only", () => {
  const baseOnboard = {
    full_name: "Rajesh Kumar",
    phone: "9876543210",
    shift_start_time: "08:00 AM",
    shift_end_time: "08:00 PM",
    street: "Plot 42, MIDC",
    city: "Pune",
    district: "Pune",
    state: "Maharashtra",
    aadhaar_number: "5161 4022 1953",
  };

  // Operator without licence fails
  const opFail = OnboardingProfileSchema.safeParse({
    ...baseOnboard,
    role: "operator",
    license_number: "",
  });
  assert.equal(opFail.success, false);
  assert.ok(opFail.error.issues.some((i) => i.path.includes("license_number")));

  // Operator with licence passes
  const opPass = OnboardingProfileSchema.safeParse({
    ...baseOnboard,
    role: "operator",
    license_number: "MH12 20110012345",
  });
  assert.equal(opPass.success, true);

  // Manager without licence passes
  const mgrPass = OnboardingProfileSchema.safeParse({
    ...baseOnboard,
    role: "manager",
    license_number: "",
  });
  assert.equal(mgrPass.success, true);
});
