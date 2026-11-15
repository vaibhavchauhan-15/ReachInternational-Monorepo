"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useFormDraft, saveFileDraft, removeFileDraft, readFileDraft, clearFileDrafts } from "@/lib/hooks/useFormDraft";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Info, FileText, X, Loader2, RefreshCw, FileCheck2, CheckCircle2, AlertCircle } from "lucide-react";
import { useSignupDocumentUploads, type DocumentUploadSlot } from "@/lib/hooks/useSignupDocumentUploads";
import type { DocType } from "@reachinternational/utils";
import { DocumentUploadCard } from "@/components/documents/DocumentUploadCard";
import {
  AnimatedMail,
  AnimatedLock,
  AnimatedUser,
  AnimatedPhone,
  AnimatedMapPin,
  AnimatedShieldCheck,
  AnimatedCreditCard,
  AnimatedClock,
  AnimatedUpload,
  AnimatedBuilding2,
  AnimatedBriefcase,
} from "@/components/ui/animated-icons";
import { signup, getSupervisorsAction, type AuthFormState } from "@/app/actions/auth";
import { isSupervisedRole } from "@reachinternational/permissions";
import {
  isSignupSection1Complete,
  isSignupSection2Complete,
  isSignupSection3Complete,
  isSignupSection4Complete,
  isSignupSection5Complete,
  isSignupSection6Complete,
} from "@reachinternational/validation";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Alert,
  SearchableSelect,
  CustomTimePicker,
  ReachInternationalLogo,
  useToast,
  type SelectOption,
} from "@/components/ui";
import {
  UserAddressSection,
  FormSectionCard,
  FormSubmitButton,
} from "@/components/forms";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  validateBankAccountNumber,
  validateIfscCode,
  formatIfscCode,
  INDIAN_STATES,
  getStateById,
  computeShiftTiming,
  MACHINE_CATEGORY_SELECT_OPTIONS,
  normalizeMachineCategory,
} from "@reachinternational/utils";

const signupRoleOptions: SelectOption[] = [
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "hr", label: "HR" },
  { value: "operator", label: "Operator" },
];

const stateSelectOptions: SelectOption[] = INDIAN_STATES.map((s) => ({
  value: String(s.id),
  label: s.name,
}));

// Allowlist for draft persistence — passwords are strictly excluded for security
const DRAFT_FIELDS = [
  "full_name", "email", "phone", "role", "supervisor_id", "machine_category",
  "shift_start_time", "shift_end_time",
  "street", "city", "district", "state", "state_id", "address",
  "bank_account_number", "bank_ifsc_code",
  "aadhaar_number", "license_number",
  "agreed_to_terms",
] as const;

const DRAFT_KEY = "signup_draft_v1";

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<AuthFormState>({});
  const [pending, setPending] = useState(false);
  const isSubmittingRef = useRef(false);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [formValues, setFormValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "operator",
    supervisor_id: "",
    machine_category: "",
    shift_start_time: "08:00 AM",
    shift_end_time: "08:00 PM",
    street: "",
    city: "",
    district: "",
    state: "",
    state_id: "",
    address: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    aadhaar_number: "",
    license_number: "",
    password: "",
    confirm_password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [supervisorOptions, setSupervisorOptions] = useState<SelectOption[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const draftValues = useMemo(
    () => ({
      ...formValues,
      agreed_to_terms: agreedToTerms,
    }),
    [formValues, agreedToTerms]
  );

  // Draft persistence: saves non-sensitive fields to localStorage (survives tab close/reload)
  const { restoredAt: textRestoredAt, clear: clearDraft } = useFormDraft(
    DRAFT_KEY,
    DRAFT_FIELDS,
    draftValues,
    (d) => {
      const cleanMachineCat = d.machine_category
        ? normalizeMachineCategory(d.machine_category) || d.machine_category
        : "";
      setFormValues((v) => ({
        ...v,
        ...d,
        machine_category: cleanMachineCat || v.machine_category,
        password: v.password,
        confirm_password: v.confirm_password,
      }));
      if (typeof d.agreed_to_terms === "boolean") {
        setAgreedToTerms(d.agreed_to_terms);
      }
    },
  );

  const [filesRestoredAt, setFilesRestoredAt] = useState<number | null>(null);
  const restoredAt = textRestoredAt || filesRestoredAt;

  const {
    slots: docSlots,
    uploadFile,
    retryUpload,
    ensureFreshSessionForSubmit,
    clearAll: clearDocumentSlots,
    isMandatoryReady,
    isAnyUploading,
  } = useSignupDocumentUploads();

  const handleSlotFileChange = useCallback(
    (docType: DocType, file: File | null) => {
      if (file) {
        saveFileDraft(DRAFT_KEY, docType === "driving_license" ? "license" : docType, file);
      } else {
        removeFileDraft(DRAFT_KEY, docType === "driving_license" ? "license" : docType);
      }
      uploadFile(docType, file);
      const errKey =
        docType === "bank_document"
          ? "bank_document_file"
          : docType === "aadhaar"
          ? "aadhaar_file"
          : "license_file";
      setFieldErrors((prev) => {
        if (!prev[errKey]) return prev;
        const copy = { ...prev };
        delete copy[errKey];
        return copy;
      });
    },
    [uploadFile]
  );

  // Restore files from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bank, aadhaar, license] = await Promise.all([
          readFileDraft(DRAFT_KEY, "bank_document"),
          readFileDraft(DRAFT_KEY, "aadhaar"),
          readFileDraft(DRAFT_KEY, "license"),
        ]);
        if (cancelled) return;
        let restoredCount = 0;
        if (bank) {
          uploadFile("bank_document", bank);
          restoredCount++;
        }
        if (aadhaar) {
          uploadFile("aadhaar", aadhaar);
          restoredCount++;
        }
        if (license) {
          uploadFile("driving_license", license);
          restoredCount++;
        }
        if (restoredCount > 0) {
          setFilesRestoredAt(Date.now());
        }
      } catch (err) {
        console.warn("Draft file restore error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uploadFile]);

  const handleStartFresh = useCallback(() => {
    clearDraft();
    clearFileDrafts(DRAFT_KEY);
    clearDocumentSlots();
    setFilesRestoredAt(null);
    setDraftDismissed(true);
    setIsSubmittedSuccess(false);
    setFormValues({
      full_name: "",
      email: "",
      phone: "",
      role: "operator",
      supervisor_id: "",
      machine_category: "",
      shift_start_time: "08:00 AM",
      shift_end_time: "08:00 PM",
      street: "",
      city: "",
      district: "",
      state: "",
      state_id: "",
      address: "",
      bank_account_number: "",
      bank_ifsc_code: "",
      aadhaar_number: "",
      license_number: "",
      password: "",
      confirm_password: "",
    });
    setFieldErrors({});
    setState({});
    setAgreedToTerms(false);
  }, [clearDraft, clearDocumentSlots]);

  useEffect(() => {
    let isMounted = true;
    async function loadSupervisors() {
      setLoadingSupervisors(true);
      try {
        const sups = await getSupervisorsAction();
        if (isMounted && sups && sups.length > 0) {
          setSupervisorOptions(
            sups.map((s) => ({
              value: s.value,
              label: s.label,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load supervisors in signup page:", err);
      } finally {
        if (isMounted) setLoadingSupervisors(false);
      }
    }

    loadSupervisors();
    return () => {
      isMounted = false;
    };
  }, []);

  const shiftTimingSummary = useMemo(() => {
    if (!formValues.shift_start_time || !formValues.shift_end_time) return null;
    return computeShiftTiming({
      startTime: formValues.shift_start_time,
      endTime: formValues.shift_end_time,
    });
  }, [formValues.shift_start_time, formValues.shift_end_time]);

  const section1Complete = useMemo(() => {
    return isSignupSection1Complete({
      full_name: formValues.full_name,
      email: formValues.email,
      phone: formValues.phone,
      role: formValues.role,
      supervisor_id: formValues.supervisor_id,
      machine_category: formValues.machine_category,
    });
  }, [
    formValues.full_name,
    formValues.email,
    formValues.phone,
    formValues.role,
    formValues.supervisor_id,
    formValues.machine_category,
  ]);

  const section2Complete = useMemo(() => {
    return isSignupSection2Complete({
      shift_start_time: formValues.shift_start_time,
      shift_end_time: formValues.shift_end_time,
    });
  }, [formValues.shift_start_time, formValues.shift_end_time]);

  const section3Complete = useMemo(() => {
    return isSignupSection3Complete({
      street: formValues.street,
      address: formValues.address,
      city: formValues.city,
      district: formValues.district,
      state: formValues.state,
      state_id: formValues.state_id,
    });
  }, [
    formValues.street,
    formValues.address,
    formValues.city,
    formValues.district,
    formValues.state,
    formValues.state_id,
  ]);

  const section4Complete = useMemo(() => {
    return isSignupSection4Complete({
      bank_account_number: formValues.bank_account_number,
      bank_ifsc_code: formValues.bank_ifsc_code,
      has_bank_doc: docSlots.bank_document.status === "ready",
    });
  }, [formValues.bank_account_number, formValues.bank_ifsc_code, docSlots.bank_document.status]);

  const section5Complete = useMemo(() => {
    return isSignupSection5Complete({
      aadhaar_number: formValues.aadhaar_number,
      has_aadhaar_doc: docSlots.aadhaar.status === "ready",
    });
  }, [formValues.aadhaar_number, docSlots.aadhaar.status]);

  const section6Complete = useMemo(() => {
    return isSignupSection6Complete({
      password: formValues.password,
      confirm_password: formValues.confirm_password,
      agreed_to_terms: agreedToTerms,
    });
  }, [formValues.password, formValues.confirm_password, agreedToTerms]);

  const passwordsMatch = useMemo(() => {
    return Boolean(
      formValues.password &&
      formValues.confirm_password &&
      formValues.password === formValues.confirm_password
    );
  }, [formValues.password, formValues.confirm_password]);

  const isAllMandatoryFilled = useMemo(() => {
    return (
      section1Complete &&
      section2Complete &&
      section3Complete &&
      section4Complete &&
      section5Complete &&
      section6Complete
    );
  }, [
    section1Complete,
    section2Complete,
    section3Complete,
    section4Complete,
    section5Complete,
    section6Complete,
  ]);

  const completedSectionsCount = useMemo(() => {
    return [
      section1Complete,
      section2Complete,
      section3Complete,
      section4Complete,
      section5Complete,
      section6Complete,
    ].filter(Boolean).length;
  }, [
    section1Complete,
    section2Complete,
    section3Complete,
    section4Complete,
    section5Complete,
    section6Complete,
  ]);

  const progressPercent = Math.round((completedSectionsCount / 6) * 100);

  const scrollToSection = useCallback((secNum: number) => {
    const elementIdMap: Record<number, string> = {
      1: "section-account-role",
      2: "section-work-shift",
      3: "section-address-details",
      4: "section-banking-details",
      5: "section-identity-verification",
      6: "section-security-credentials",
    };
    const targetId = elementIdMap[secNum];
    if (targetId) {
      const elem = document.getElementById(targetId);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, []);

  const missingMandatoryList = useMemo(() => {
    const list: string[] = [];
    if (!formValues.full_name.trim() || formValues.full_name.trim().length < 2) {
      list.push("Full Name");
    }
    if (!formValues.email.trim() || !formValues.email.includes("@")) {
      list.push("Email Address");
    }
    if (formValues.phone.trim().replace(/\D/g, "").length < 10) {
      list.push("Mobile Number");
    }
    if (isSupervisedRole(formValues.role) && !formValues.supervisor_id.trim()) {
      list.push("Supervisor");
    }
    if (formValues.role === "operator" && !formValues.machine_category.trim()) {
      list.push("Machine Category");
    }
    if (!formValues.shift_start_time.trim() || !formValues.shift_end_time.trim()) {
      list.push("Shift Timing");
    }
    if (!(formValues.street || formValues.address).trim()) {
      list.push("Street Address");
    }
    if (!formValues.city.trim()) {
      list.push("City");
    }
    if (!formValues.district.trim()) {
      list.push("District");
    }
    if (!formValues.state.trim() && !formValues.state_id) {
      list.push("State");
    }
    if (!formValues.bank_account_number.trim() || !validateBankAccountNumber(formValues.bank_account_number).isValid) {
      list.push("Bank Account Number");
    }
    if (!formValues.bank_ifsc_code.trim() || !validateIfscCode(formValues.bank_ifsc_code).isValid) {
      list.push("IFSC Code");
    }
    if (docSlots.bank_document.status !== "ready") {
      list.push(
        docSlots.bank_document.status === "uploading" || docSlots.bank_document.status === "compressing"
          ? "Bank Document (Uploading...)"
          : "Bank Document Photo"
      );
    }
    if (formValues.aadhaar_number.trim().replace(/\D/g, "").length !== 12) {
      list.push("Aadhaar Number");
    }
    if (docSlots.aadhaar.status !== "ready") {
      list.push(
        docSlots.aadhaar.status === "uploading" || docSlots.aadhaar.status === "compressing"
          ? "Aadhaar Document (Uploading...)"
          : "Aadhaar Document Photo"
      );
    }
    if (formValues.password.length < 8) {
      list.push("Password");
    }
    if (formValues.confirm_password.length < 8 || formValues.password !== formValues.confirm_password) {
      list.push("Confirm Password");
    }
    if (!agreedToTerms) {
      list.push("Terms & Privacy Policy");
    }
    return list;
  }, [
    formValues.full_name,
    formValues.email,
    formValues.phone,
    formValues.role,
    formValues.supervisor_id,
    formValues.machine_category,
    formValues.shift_start_time,
    formValues.shift_end_time,
    formValues.street,
    formValues.address,
    formValues.city,
    formValues.district,
    formValues.state,
    formValues.state_id,
    formValues.bank_account_number,
    formValues.bank_ifsc_code,
    docSlots.bank_document.status,
    formValues.aadhaar_number,
    docSlots.aadhaar.status,
    formValues.password,
    formValues.confirm_password,
    agreedToTerms,
  ]);

  const handleAddressChange = (field: "street" | "city" | "district" | "state" | "state_id", value: string) => {
    if (field === "street") {
      setFormValues((prev) => ({ ...prev, street: value, address: value }));
    } else if (field === "state_id") {
      const matchedState = getStateById(value);
      setFormValues((prev) => ({
        ...prev,
        state_id: value,
        state: matchedState ? matchedState.name : prev.state,
      }));
    } else {
      setFormValues((prev) => ({ ...prev, [field]: value }));
    }

    if (
      fieldErrors[field] ||
      (field === "state_id" && fieldErrors.state) ||
      (field === "street" && (fieldErrors.street || fieldErrors.address))
    ) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        if (field === "state_id") delete copy.state;
        if (field === "street") {
          delete copy.street;
          delete copy.address;
        }
        return copy;
      });
    }
  };

  const handleChange = (field: string, value: string) => {
    let formattedVal = value;
    if (field === "bank_account_number") {
      formattedVal = value.replace(/\D/g, "").slice(0, 20);
    } else if (field === "bank_ifsc_code") {
      formattedVal = formatIfscCode(value).slice(0, 11);
    } else if (field === "aadhaar_number") {
      formattedVal = formatAadhaar(value);
    } else if (field === "license_number") {
      formattedVal = value.toUpperCase();
    }

    if (field === "state_id") {
      const matchedState = getStateById(value);
      setFormValues((prev) => ({
        ...prev,
        state_id: value,
        state: matchedState ? matchedState.name : prev.state,
      }));
    } else if (field === "street") {
      setFormValues((prev) => ({ ...prev, street: formattedVal, address: formattedVal }));
    } else if (field === "address") {
      setFormValues((prev) => ({ ...prev, address: formattedVal, street: formattedVal }));
    } else if (field === "machine_category") {
      const norm = normalizeMachineCategory(value) || value;
      setFormValues((prev) => ({ ...prev, machine_category: norm }));
      setFieldErrors((prev) => {
        if (!prev.machine_category) return prev;
        const copy = { ...prev };
        delete copy.machine_category;
        return copy;
      });
      return;
    } else {
      setFormValues((prev) => ({ ...prev, [field]: formattedVal }));
    }

    if (field === "password" || field === "confirm_password") {
      const p = field === "password" ? formattedVal : formValues.password;
      const cp = field === "confirm_password" ? formattedVal : formValues.confirm_password;
      if (p && cp && p === cp) {
        setFieldErrors((prev) => {
          if (!prev.confirm_password) return prev;
          const copy = { ...prev };
          delete copy.confirm_password;
          return copy;
        });
      }
    }

    // Instant validation for Bank Account Number
    if (field === "bank_account_number") {
      if (formattedVal.length >= 9) {
        const res = validateBankAccountNumber(formattedVal);
        if (!res.isValid) {
          setFieldErrors((prev) => ({ ...prev, bank_account_number: res.error || "Invalid bank account number" }));
          return;
        }
      }
    }

    // Instant validation for IFSC Code
    if (field === "bank_ifsc_code") {
      if (formattedVal.length === 11) {
        const res = validateIfscCode(formattedVal);
        if (!res.isValid) {
          setFieldErrors((prev) => ({ ...prev, bank_ifsc_code: res.error || "Invalid IFSC code" }));
          return;
        }
      }
    }

    // Instant validation for Aadhaar
    if (field === "aadhaar_number") {
      const clean = formattedVal.replace(/\D/g, "");
      if (clean.length === 12) {
        const res = validateAadhaarNumber(clean);
        if (!res.isValid) {
          setFieldErrors((prev) => ({ ...prev, aadhaar_number: res.error || "Invalid Aadhaar number" }));
          return;
        }
      }
    }

    if (
      fieldErrors[field] ||
      (field === "state_id" && fieldErrors.state) ||
      ((field === "street" || field === "address") && (fieldErrors.street || fieldErrors.address))
    ) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        if (field === "state_id") delete copy.state;
        if (field === "street" || field === "address") {
          delete copy.street;
          delete copy.address;
        }
        return copy;
      });
    }
  };

  const handleBlur = (field: string) => {
    if (field === "bank_account_number" && formValues.bank_account_number.trim()) {
      const res = validateBankAccountNumber(formValues.bank_account_number);
      if (!res.isValid) {
        setFieldErrors((prev) => ({ ...prev, bank_account_number: res.error || "Invalid bank account number" }));
      }
    } else if (field === "bank_ifsc_code" && formValues.bank_ifsc_code.trim()) {
      const res = validateIfscCode(formValues.bank_ifsc_code);
      if (!res.isValid) {
        setFieldErrors((prev) => ({ ...prev, bank_ifsc_code: res.error || "Invalid IFSC code format" }));
      }
    } else if (field === "aadhaar_number" && formValues.aadhaar_number.trim()) {
      const res = validateAadhaarNumber(formValues.aadhaar_number);
      if (!res.isValid) {
        setFieldErrors((prev) => ({ ...prev, aadhaar_number: res.error || "Invalid Aadhaar number" }));
      }
    } else if (field === "license_number" && formValues.license_number.trim()) {
      const res = validateLicenseNumber(formValues.license_number);
      if (!res.isValid) {
        setFieldErrors((prev) => ({ ...prev, license_number: res.error || "Invalid driving licence format" }));
      }
    }
  };

  function isRedirectError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const err = error as Record<string, unknown>;
    if (typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      return true;
    }
    if (err.message === "NEXT_REDIRECT") {
      return true;
    }
    return false;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingRef.current || pending) return;

    // Client-side pre-flight checks aligned with all mandatory sections
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
    if (formValues.role === "operator" && !formValues.machine_category.trim()) {
      errors.machine_category = "Please select a machine category.";
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
        errors.bank_account_number = bankRes.error || "Valid bank account required (9-18 digits).";
      }
    }
    if (!formValues.bank_ifsc_code.trim()) {
      errors.bank_ifsc_code = "IFSC code is required.";
    } else {
      const ifscRes = validateIfscCode(formValues.bank_ifsc_code);
      if (!ifscRes.isValid) {
        errors.bank_ifsc_code = ifscRes.error || "Valid 11-character IFSC code required.";
      }
    }
    if (docSlots.bank_document.status !== "ready") {
      errors.bank_document_file = "Bank document photo is required.";
    }
    if (!formValues.aadhaar_number.trim()) {
      errors.aadhaar_number = "Valid 12-digit Aadhaar required.";
    } else {
      const aadhaarRes = validateAadhaarNumber(formValues.aadhaar_number);
      if (!aadhaarRes.isValid) {
        errors.aadhaar_number = aadhaarRes.error || "Valid 12-digit Aadhaar required.";
      }
    }
    if (docSlots.aadhaar.status !== "ready") {
      errors.aadhaar_file = "Aadhaar document photo is required.";
    }
    if (docSlots.driving_license.status === "failed") {
      errors.license_file = docSlots.driving_license.error || "Licence document upload failed.";
    }
    if (formValues.license_number.trim()) {
      const licRes = validateLicenseNumber(formValues.license_number);
      if (!licRes.isValid) {
        errors.license_number = licRes.error || "Invalid licence format.";
      }
    }
    if (!formValues.password || formValues.password.length < 8) {
      errors.password = "Must be at least 8 characters.";
    } else {
      const hasUppercase = /[A-Z]/.test(formValues.password);
      const hasLowercase = /[a-z]/.test(formValues.password);
      const hasDigit = /\d/.test(formValues.password);
      if (!hasUppercase || !hasLowercase || !hasDigit) {
        errors.password = "Must include uppercase, lowercase, and a number.";
      }
    }
    if (!formValues.confirm_password) {
      errors.confirm_password = "Confirm password is required.";
    } else if (formValues.password !== formValues.confirm_password) {
      errors.confirm_password = "Passwords do not match.";
    }
    if (!agreedToTerms) {
      errors.terms = "Please agree to Terms and Privacy Policy.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      isSubmittingRef.current = false;
      setPending(false);
      toast("error", "Please Complete All Required Fields", "Please fill in all highlighted fields to submit your registration.");

      // Auto-scroll to first error element
      const firstErrorKey = Object.keys(errors)[0];
      const elementIdMap: Record<string, string> = {
        full_name: "signup-full-name",
        email: "signup-email",
        phone: "signup-phone",
        role: "signup-role-container",
        supervisor_id: "signup-supervisor",
        machine_category: "signup-machine-category",
        shift_start_time: "signup-shift-start",
        shift_end_time: "signup-shift-end",
        street: "signup-street",
        address: "signup-street",
        city: "signup-city",
        district: "signup-district",
        state: "signup-state-container",
        bank_account_number: "signup-bank-account",
        bank_ifsc_code: "signup-bank-ifsc",
        bank_document_file: "doc-upload-bank_document",
        aadhaar_number: "signup-aadhaar",
        aadhaar_file: "doc-upload-aadhaar",
        license_number: "signup-license",
        license_file: "doc-upload-driving_license",
        password: "signup-password",
        confirm_password: "signup-confirm-password",
        terms: "agree_to_terms_container",
      };
      const targetId = elementIdMap[firstErrorKey] || `signup-${firstErrorKey}`;
      const elem = document.getElementById(targetId);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth", block: "center" });
        elem.focus?.();
      }
      return;
    }

    if (isAnyUploading) {
      toast("info", "Uploads in Progress", "Please wait for your documents to finish uploading.");
      return;
    }

    if (!isMandatoryReady) {
      toast("error", "Documents Required", "Please ensure your mandatory documents are uploaded.");
      return;
    }

    isSubmittingRef.current = true;
    setPending(true);
    setState({});
    setFieldErrors({});

    // Ensure session is fresh (< 1.5h) before finalizing
    let sessionToken: string | null = null;
    try {
      const sessionRes = await ensureFreshSessionForSubmit();
      if (!sessionRes.ok || !sessionRes.session) {
        isSubmittingRef.current = false;
        setPending(false);
        toast("error", "Upload Session Expired", sessionRes.error || "Please reselect your document photos.");
        return;
      }
      sessionToken = sessionRes.session;
    } catch (sessionErr: unknown) {
      isSubmittingRef.current = false;
      setPending(false);
      console.error("[Signup] Session refresh error:", sessionErr);
      toast("error", "Session Error", "Could not establish secure upload session. Please try again.");
      return;
    }

    const formData = new FormData();

    // Pass staging session tokens
    formData.set("staging_session_token", sessionToken);
    formData.set("session", sessionToken);

    formData.set("full_name", formValues.full_name.trim());
    formData.set("email", formValues.email.trim());
    formData.set("phone", formValues.phone.trim());
    formData.set("role", formValues.role);
    formData.set("supervisor_id", formValues.supervisor_id.trim());
    if (formValues.role === "operator" && formValues.machine_category.trim()) {
      formData.set("machine_category", formValues.machine_category.trim());
    }
    formData.set("shift_start_time", formValues.shift_start_time.trim());
    formData.set("shift_end_time", formValues.shift_end_time.trim());
    formData.set(
      "shift_time",
      formValues.shift_start_time.trim() && formValues.shift_end_time.trim()
        ? `${formValues.shift_start_time.trim()} - ${formValues.shift_end_time.trim()}`
        : formValues.shift_start_time.trim() || formValues.shift_end_time.trim() || ""
    );
    formData.set("street", resolvedStreet);
    formData.set("address", resolvedStreet);
    formData.set("city", formValues.city.trim());
    formData.set("district", formValues.district.trim());
    formData.set("state", formValues.state.trim());
    if (formValues.state_id) {
      formData.set("state_id", String(formValues.state_id));
    }
    formData.set("bank_account_number", formValues.bank_account_number.trim());
    formData.set("bank_ifsc_code", formValues.bank_ifsc_code.trim().toUpperCase());
    formData.set("aadhaar_number", formValues.aadhaar_number.trim());
    if (formValues.license_number.trim()) {
      formData.set("license_number", formValues.license_number.trim().toUpperCase());
    }
    formData.set("password", formValues.password);
    formData.set("confirm_password", formValues.confirm_password);

    try {
      const result = await signup({}, formData);
      setState(result);

      // On successful signup: clear draft, trigger toast notification, and redirect to login page
      if (result.message && !result.error) {
        setIsSubmittedSuccess(true);
        clearDraft();
        clearFileDrafts(DRAFT_KEY);
        clearDocumentSlots();
        setFilesRestoredAt(null);
        toast(
          "success",
          "Registration Request Submitted! 🎉",
          "Your account is pending administrator approval. After approval from the administrator, you can log in."
        );
        setTimeout(() => {
          router.push(
            "/login?message=" +
              encodeURIComponent(
                "Registration request submitted successfully! Your account is pending administrator approval. After approval from the administrator, you can log in."
              )
          );
        }, 1200);
        return;
      }

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      } else {
        setFieldErrors({});
      }

      if (result.error) {
        toast("error", "Registration Failed", result.error);
      }

      if (result.fieldValues) {
        setFormValues((prev) => ({
          ...prev,
          full_name: result.fieldValues?.full_name ?? prev.full_name,
          email: result.fieldValues?.email ?? prev.email,
          phone: result.fieldValues?.phone ?? prev.phone,
          role: result.fieldValues?.role ?? prev.role,
          supervisor_id: result.fieldValues?.supervisor_id ?? prev.supervisor_id,
          machine_category: result.fieldValues?.machine_category ?? prev.machine_category,
          shift_start_time: result.fieldValues?.shift_start_time ?? prev.shift_start_time,
          shift_end_time: result.fieldValues?.shift_end_time ?? prev.shift_end_time,
          city: result.fieldValues?.city ?? prev.city,
          district: result.fieldValues?.district ?? prev.district,
          state: result.fieldValues?.state ?? prev.state,
          state_id: result.fieldValues?.state_id ?? prev.state_id,
          street: result.fieldValues?.street ?? result.fieldValues?.address ?? prev.street,
          address: result.fieldValues?.address ?? result.fieldValues?.street ?? prev.address,
          bank_account_number: result.fieldValues?.bank_account_number ?? prev.bank_account_number,
          bank_ifsc_code: result.fieldValues?.bank_ifsc_code ?? prev.bank_ifsc_code,
          aadhaar_number: result.fieldValues?.aadhaar_number ?? prev.aadhaar_number,
          license_number: result.fieldValues?.license_number ?? prev.license_number,
        }));
      }

      isSubmittingRef.current = false;
      setPending(false);
    } catch (err: unknown) {
      if (isRedirectError(err)) {
        throw err;
      }
      console.error("[Signup] Submission error:", err);
      isSubmittingRef.current = false;
      setPending(false);

      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      let userFriendlyError = "An unexpected error occurred. Please try again.";

      if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("429")) {
        userFriendlyError = "Too many attempts from this network. Please wait a few minutes before trying again.";
        toast("error", "Rate Limit Exceeded", userFriendlyError);
      } else if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch") || (typeof navigator !== "undefined" && !navigator.onLine)) {
        userFriendlyError = "Unable to connect to the server. Please check your internet connection and try again.";
        toast("error", "Network Connection Error", userFriendlyError);
      } else {
        toast("error", "Registration Error", userFriendlyError);
      }

      setState({ error: userFriendlyError });
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[var(--color-canvas)] text-[var(--color-ink)] lg:h-screen lg:max-h-screen lg:overflow-hidden select-none">
      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only)
          40% width, restrained dark charcoal/cool gray surface
          ============================================================ */}
      <div className="relative hidden lg:flex flex-col justify-between h-full lg:w-[40%] p-8 xl:p-10 2xl:p-12 border-r border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shrink-0">
        {/* Minimal atmospheric Reach Blue glow behind machine */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] bg-[radial-gradient(circle_at_center,rgba(2,132,199,0.09)_0%,rgba(2,132,199,0.02)_50%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12)_0%,rgba(14,165,233,0.03)_50%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Logo */}
        <div className="flex items-center justify-between z-10">
          <Link
            href="/"
            className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg transition-transform hover:scale-[1.01]"
            aria-label="Reach International Home"
          >
            <ReachInternationalLogo variant="full" size={28} />
          </Link>
        </div>

        {/* Hero Central Content: Industrial & Fleet Platform Identity */}
        <div className="my-auto flex flex-col gap-6 xl:gap-8 max-w-md xl:max-w-lg z-10 py-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-[var(--color-ink)] leading-[1.1]">
              Manage your fleet.
              <br />
              <span className="text-sky-600 dark:text-sky-400">
                Track every hour.
              </span>
            </h1>
          </div>

          {/* Machine Showcase Stage with Ground Shadow Pedestal */}
          <div className="relative pt-2 pb-1 flex items-center justify-center">
            {/* Ground Shadow Pedestal under boom lift wheels */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] xl:max-w-[420px] h-6 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.04)_50%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_50%,transparent_70%)] blur-[4px] pointer-events-none z-0" />

            {/* Industrial Machinery Transparent PNG Asset */}
            <div className="relative z-10 w-full max-w-[340px] xl:max-w-[400px] 2xl:max-w-[440px] transition-transform duration-500 hover:scale-[1.02]">
              <Image
                src="/loginpageimage.png"
                alt="Reach International Aerial Boom Lift Fleet Equipment"
                width={800}
                height={533}
                priority
                className="w-full h-auto max-h-[32vh] xl:max-h-[36vh] object-contain drop-shadow-sm dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Minimal Bottom Spacer */}
        <div className="h-4 z-10" />
      </div>

      {/* ============================================================
          Right: Dedicated Registration Workspace (60% width on desktop)
          Clean floating card, responsive single-focus view on mobile
          ============================================================ */}
      <div className="relative flex-1 lg:w-[60%] w-full min-h-screen lg:h-full flex flex-col justify-between items-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-3.5 xl:px-10 xl:py-4 overflow-y-auto bg-[var(--color-canvas)]">
        {/* Top Spacer for balanced desktop vertical distribution */}
        <div className="hidden lg:block w-full h-1 shrink-0" />
        <div className="w-full flex items-center justify-center my-auto py-1 sm:py-1.5">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl lg:max-w-2xl bg-[var(--color-canvas-elevated)] rounded-2xl border border-[var(--color-hairline)] p-4 sm:p-5 lg:p-5.5 shadow-2xl text-[var(--color-ink)] relative overflow-hidden"
          >
            {/* Mobile Only: Top Header Logo */}
            <div className="flex lg:hidden flex-col items-center justify-center mb-2.5 sm:mb-3">
              <Link href="/" className="flex items-center group focus:outline-none" aria-label="Reach International">
                <ReachInternationalLogo variant="full" size={26} />
              </Link>
            </div>

            {/* Card Header — Clean title */}
            <div className="mb-3 sm:mb-3.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                Create an account
              </h2>
            </div>

            {/* Global Error Banner */}
            {state.error && Object.keys(fieldErrors).length === 0 && (
              <div className="mb-3">
                <Alert
                  variant="error"
                  onDismiss={() => setState((prev) => ({ ...prev, error: undefined }))}
                >
                  {state.error}
                </Alert>
              </div>
            )}

            {/* Draft Restored Notice */}
            {restoredAt && !draftDismissed && (
              <div className="mb-3">
                <Alert
                  variant="info"
                  onDismiss={() => setDraftDismissed(true)}
                  action={
                    <button
                      type="button"
                      onClick={handleStartFresh}
                      className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer"
                    >
                      Start fresh
                    </button>
                  }
                >
                  Draft restored from {new Date(restoredAt).toLocaleString()}. Re-enter your password to continue.
                </Alert>
              </div>
            )}

            {/* Registration Progress Stepper */}
            <div className="mb-3.5 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink)]">
                  Registration Progress
                </span>
                <span className="text-[11px] font-medium text-[var(--color-mute)]">
                  {completedSectionsCount} of 6 steps completed ({progressPercent}%)
                </span>
              </div>
              {/* Progress Bar Track */}
              <div className="w-full h-1.5 rounded-full bg-[var(--color-hairline)] overflow-hidden mb-2.5">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
              {/* Quick Section Jump Chips */}
              <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                {[
                  { num: 1, label: "Role", done: section1Complete },
                  { num: 2, label: "Shift", done: section2Complete },
                  { num: 3, label: "Address", done: section3Complete },
                  { num: 4, label: "Bank", done: section4Complete },
                  { num: 5, label: "ID", done: section5Complete },
                  { num: 6, label: "Login", done: section6Complete },
                ].map((step) => (
                  <button
                    key={step.num}
                    type="button"
                    onClick={() => scrollToSection(step.num)}
                    className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] sm:text-[11px] font-semibold border transition-all cursor-pointer ${
                      step.done
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                        : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] hover:border-[var(--color-hairline-hover)] hover:text-[var(--color-ink)]"
                    }`}
                    title={`Jump to step ${step.num}: ${step.label}`}
                  >
                    <span>{step.done ? "✓" : step.num}</span>
                    <span className="truncate hidden sm:inline">{step.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5 sm:gap-3">
              {/* Hidden Inputs for Shift Timing */}
              <input type="hidden" name="shift_start_time" value={formValues.shift_start_time} />
              <input type="hidden" name="shift_end_time" value={formValues.shift_end_time} />
              <input
                type="hidden"
                name="shift_time"
                value={
                  formValues.shift_start_time.trim() && formValues.shift_end_time.trim()
                    ? `${formValues.shift_start_time.trim()} - ${formValues.shift_end_time.trim()}`
                    : formValues.shift_start_time.trim() || formValues.shift_end_time.trim() || ""
                }
              />

              {/* Section 1: Account Information & Role */}
              <FormSectionCard
                id="section-account-role"
                stepNumber={1}
                title="Account & Role"
                isMandatory={true}
                isCompleted={section1Complete}
              >
                {/* Row 1: Full Name | Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <Input
                    id="signup-full-name"
                    name="full_name"
                    label="Full Name"
                    type="text"
                    value={formValues.full_name}
                    onChange={(e) => handleChange("full_name", e.target.value)}
                    placeholder="Rahul Sharma"
                    required
                    autoComplete="name"
                    error={fieldErrors.full_name}
                    hint="Enter your official name as shown on your Aadhaar card."
                    icon={<AnimatedUser size={15} />}
                  />

                  <Input
                    id="signup-email"
                    name="email"
                    label="Email Address"
                    type="email"
                    value={formValues.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="rahul@domain.com"
                    required
                    autoComplete="email"
                    error={fieldErrors.email}
                    hint="Used for account login and notifications."
                    icon={<AnimatedMail size={15} />}
                  />
                </div>

                {/* Row 2: Mobile Number | Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <Input
                    id="signup-phone"
                    name="phone"
                    label="Mobile Number"
                    type="tel"
                    value={formValues.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    autoComplete="tel"
                    error={fieldErrors.phone}
                    hint="10-digit mobile number for shift alerts and WhatsApp updates."
                    icon={<AnimatedPhone size={15} />}
                  />

                  {/* Account Role Dropdown */}
                  <div id="signup-role-container" className="flex flex-col gap-1 w-full">
                    <label className="text-[13px] sm:text-[13.5px] font-semibold text-[var(--color-ink)] select-none flex items-center gap-1">
                      <span>Role Requested</span>
                      <span className="text-rose-500 font-semibold">*</span>
                    </label>
                    <input type="hidden" name="role" value={formValues.role} />
                    <SearchableSelect
                      options={signupRoleOptions}
                      value={formValues.role}
                      onChange={(val) => {
                        handleChange("role", val);
                        if (!isSupervisedRole(val)) {
                          handleChange("supervisor_id", "");
                        }
                        if (val !== "operator") {
                          handleChange("machine_category", "");
                        }
                      }}
                      placeholder="Select role..."
                      clearable={false}
                      error={fieldErrors.role}
                      icon={<AnimatedUser size={15} />}
                      className="w-full text-xs sm:text-[13px]"
                    />
                    <p className="text-[11px] text-[var(--color-mute)] mt-0.5">Select your job position at Reach International.</p>
                  </div>
                </div>

                {/* Row 3: Conditional Supervisor Selector when Role is Operator */}
                {isSupervisedRole(formValues.role) && (
                  <div id="signup-supervisor" className="flex flex-col gap-1 w-full pt-1 border-t border-[var(--color-hairline)]/60">
                    <label className="text-[13px] sm:text-[13.5px] font-semibold text-[var(--color-ink)] select-none flex items-center gap-1">
                      <span>Select Supervisor</span>
                      <span className="text-rose-500 font-semibold">*</span>
                    </label>
                    <input type="hidden" name="supervisor_id" value={formValues.supervisor_id} />
                    <SearchableSelect
                      options={supervisorOptions}
                      value={formValues.supervisor_id}
                      onChange={(val) => handleChange("supervisor_id", val)}
                      placeholder={
                        loadingSupervisors
                          ? "Loading supervisors..."
                          : supervisorOptions.length === 0
                          ? "No active supervisors found"
                          : "Search or scroll to select supervisor..."
                      }
                      clearable={true}
                      error={fieldErrors.supervisor_id}
                      icon={<AnimatedShieldCheck size={15} />}
                      className="w-full text-xs sm:text-[13px]"
                    />
                    <p className="text-[11px] text-[var(--color-mute)] mt-0.5">Choose the site manager who oversees your work shift.</p>
                  </div>
                )}

                {/* Row 4: Conditional Machine Category Selector when Role is Operator */}
                {formValues.role === "operator" && (
                  <div id="signup-machine-category" className="flex flex-col gap-1 w-full pt-1 border-t border-[var(--color-hairline)]/60">
                    <label className="text-[13px] sm:text-[13.5px] font-semibold text-[var(--color-ink)] select-none flex items-center gap-1">
                      <span>Machine Category</span>
                      <span className="text-rose-500 font-semibold">*</span>
                    </label>
                    <input type="hidden" name="machine_category" value={formValues.machine_category} />
                    <SearchableSelect
                      options={MACHINE_CATEGORY_SELECT_OPTIONS}
                      value={formValues.machine_category}
                      onChange={(val) => handleChange("machine_category", val)}
                      placeholder="Select machine category..."
                      clearable={true}
                      error={fieldErrors.machine_category}
                      icon={<AnimatedBriefcase size={15} />}
                      className="w-full text-xs sm:text-[13px]"
                    />
                    <p className="text-[11px] text-[var(--color-mute)] mt-0.5">Select the primary equipment you are certified to operate.</p>
                  </div>
                )}
              </FormSectionCard>

              {/* Section 2: Work Shift Schedule */}
              <FormSectionCard
                id="section-work-shift"
                stepNumber={2}
                title="Work Shift Schedule"
                isMandatory={true}
                isCompleted={section2Complete}
                headerAction={
                  shiftTimingSummary?.isValid ? (
                    <span className="inline-flex items-center text-[10px] font-semibold font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      {shiftTimingSummary.durationMinutes % 60 === 0
                        ? `${shiftTimingSummary.durationMinutes / 60}h`
                        : `${Number(shiftTimingSummary.durationHours.toFixed(1))}h`}
                    </span>
                  ) : null
                }
              >
                {/* Shift Start Time | Shift End Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div id="signup-shift-start">
                    <CustomTimePicker
                      label="Shift Start Time"
                      value={formValues.shift_start_time}
                      onChange={(val) => handleChange("shift_start_time", val)}
                      placeholder="08:00 AM"
                      required
                      hideIcon
                      error={fieldErrors.shift_start_time}
                    />
                  </div>
                  <div id="signup-shift-end">
                    <CustomTimePicker
                      label="Shift End Time"
                      value={formValues.shift_end_time}
                      onChange={(val) => handleChange("shift_end_time", val)}
                      placeholder="08:00 PM"
                      required
                      hideIcon
                      error={fieldErrors.shift_end_time}
                    />
                  </div>
                </div>
              </FormSectionCard>

              {/* Section 3: Address Details */}
              <FormSectionCard
                id="section-address-details"
                stepNumber={3}
                title="Address Details"
                isMandatory={true}
                isCompleted={section3Complete}
              >
                {/* Standardized Address Section: street + city/town/village + district + state */}
                <UserAddressSection
                  street={formValues.street || formValues.address}
                  city={formValues.city}
                  district={formValues.district}
                  state={formValues.state}
                  stateId={formValues.state_id}
                  onChange={handleAddressChange}
                  errors={fieldErrors}
                  required={true}
                  idPrefix="signup"
                />
              </FormSectionCard>

              {/* Section 4: Banking Details */}
              <FormSectionCard
                id="section-banking-details"
                stepNumber={4}
                title="Banking Details"
                isMandatory={true}
                isCompleted={section4Complete}
              >
                <div className="space-y-2.5 sm:space-y-3">
                  {/* Salary Transfer Guidance Notice */}
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] sm:text-xs text-sky-800 dark:text-sky-200">
                    <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                    <span>Your monthly salary will be transferred to this bank account. Please ensure the Account Number and IFSC match your passbook or cheque.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                    <Input
                      id="signup-bank-account"
                      name="bank_account_number"
                      label="Bank Account Number"
                      type="text"
                      inputMode="numeric"
                      value={formValues.bank_account_number}
                      onChange={(e) => handleChange("bank_account_number", e.target.value)}
                      onBlur={() => handleBlur("bank_account_number")}
                      placeholder="9 to 18-digit Account Number"
                      maxLength={20}
                      required
                      error={fieldErrors.bank_account_number}
                      hint="Enter 9 to 18 digits printed on your passbook."
                      icon={<AnimatedCreditCard size={15} />}
                    />

                    <Input
                      id="signup-bank-ifsc"
                      name="bank_ifsc_code"
                      label="IFSC Code"
                      type="text"
                      value={formValues.bank_ifsc_code}
                      onChange={(e) => handleChange("bank_ifsc_code", e.target.value)}
                      onBlur={() => handleBlur("bank_ifsc_code")}
                      placeholder="e.g. SBIN0001234"
                      maxLength={11}
                      required
                      autoCapitalize="characters"
                      error={fieldErrors.bank_ifsc_code}
                      hint="11-character code printed on cheque or passbook (e.g. SBIN0001234)."
                      icon={<AnimatedBuilding2 size={15} />}
                    />
                  </div>

                  {/* Bank Document Upload Card (Mandatory: Passbook / Cheque / Statement) */}
                  <DocumentUploadCard
                    title="Bank Account Document"
                    required
                    helperText="Upload Passbook / Cheque / Statement (JPG or PNG)"
                    docType="bank_document"
                    slot={docSlots.bank_document}
                    onFileSelect={(file) => handleSlotFileChange("bank_document", file)}
                    onRetry={() => retryUpload("bank_document")}
                    fieldError={fieldErrors.bank_document_file}
                  />
                </div>
              </FormSectionCard>

              {/* Section 5: Identity Verification */}
              <FormSectionCard
                id="section-identity-verification"
                stepNumber={5}
                title="Identity Verification"
                isMandatory={true}
                isCompleted={section5Complete}
              >
                <div className="space-y-2.5 sm:space-y-3">
                  {/* Aadhaar Card Number | Driving Licence Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                    <Input
                      id="signup-aadhaar"
                      name="aadhaar_number"
                      label="Aadhaar Card Number"
                      type="text"
                      value={formValues.aadhaar_number}
                      onChange={(e) => handleChange("aadhaar_number", e.target.value)}
                      onBlur={() => handleBlur("aadhaar_number")}
                      placeholder="12-digit Aadhaar Number"
                      maxLength={14}
                      required
                      error={fieldErrors.aadhaar_number}
                      hint="12-digit UIDAI number. Will be formatted as XXXX XXXX XXXX."
                      icon={<AnimatedShieldCheck size={15} />}
                    />

                    <Input
                      id="signup-license"
                      name="license_number"
                      label={
                        <span>
                          Driving Licence Number <span className="text-[11px] font-normal text-[var(--color-mute)]">(Optional)</span>
                        </span>
                      }
                      type="text"
                      value={formValues.license_number}
                      onChange={(e) => handleChange("license_number", e.target.value)}
                      onBlur={() => handleBlur("license_number")}
                      placeholder="e.g. MH12 20110012345"
                      maxLength={25}
                      error={fieldErrors.license_number}
                      hint="Required if operating Forklift, Boom Lift, or other equipment."
                      icon={<AnimatedCreditCard size={15} />}
                    />
                  </div>

                  {/* Document Uploads: Aadhaar Card & Driving Licence */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                    {/* Aadhaar Upload Card */}
                    <DocumentUploadCard
                      title="Aadhaar Document"
                      required
                      helperText="Upload Aadhaar (JPG or PNG)"
                      docType="aadhaar"
                      slot={docSlots.aadhaar}
                      onFileSelect={(file) => handleSlotFileChange("aadhaar", file)}
                      onRetry={() => retryUpload("aadhaar")}
                      fieldError={fieldErrors.aadhaar_file}
                    />

                    {/* Licence Upload Card */}
                    <DocumentUploadCard
                      title="Licence Document"
                      required={false}
                      helperText="Upload Licence (JPG or PNG)"
                      docType="driving_license"
                      slot={docSlots.driving_license}
                      onFileSelect={(file) => handleSlotFileChange("driving_license", file)}
                      onRetry={() => retryUpload("driving_license")}
                      fieldError={fieldErrors.license_file}
                    />
                  </div>
                </div>
              </FormSectionCard>

              {/* Section 6: Security Credentials */}
              <FormSectionCard
                id="section-security-credentials"
                stepNumber={6}
                title="Security Credentials"
                isMandatory={true}
                isCompleted={section6Complete}
              >
                {/* Password | Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <Input
                    id="signup-password"
                    name="password"
                    label="Password"
                    type="password"
                    value={formValues.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="new-password"
                    error={fieldErrors.password}
                    isSuccess={passwordsMatch && !fieldErrors.password}
                    hint="At least 8 characters with letters and numbers. Keep it secret."
                    icon={<AnimatedLock size={15} />}
                  />

                  <Input
                    id="signup-confirm-password"
                    name="confirm_password"
                    label="Confirm Password"
                    type="password"
                    value={formValues.confirm_password}
                    onChange={(e) => handleChange("confirm_password", e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="new-password"
                    error={fieldErrors.confirm_password}
                    isSuccess={passwordsMatch && !fieldErrors.confirm_password}
                    hint="Type the exact same password again to verify."
                    icon={<AnimatedLock size={15} />}
                  />
                </div>
                {passwordsMatch && !fieldErrors.password && !fieldErrors.confirm_password && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} className="shrink-0" />
                    Passwords match
                  </p>
                )}
                <p className="text-[11px] text-[var(--color-mute)] mt-2">
                  Password must be at least 8 characters long. Make sure both passwords match.
                </p>
              </FormSectionCard>

              {/* Note banner: Shown ONLY after successful submit */}
              {isSubmittedSuccess && (
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 sm:p-3 text-[11px] sm:text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-emerald-900 dark:text-emerald-100">Note: </strong>
                    Account status will be &ldquo;pending&rdquo; until approved by an administrator.
                  </div>
                </div>
              )}

              {/* Terms and Privacy Policy Agreement Checkbox */}
              <div
                id="agree_to_terms_container"
                onClick={() => {
                  setAgreedToTerms((prev) => {
                    const next = !prev;
                    if (next) {
                      setFieldErrors((prevErr) => {
                        const copy = { ...prevErr };
                        delete copy.terms;
                        return copy;
                      });
                    }
                    return next;
                  });
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  fieldErrors.terms
                    ? "border-rose-500/60 bg-rose-500/5 dark:bg-rose-500/10 ring-1 ring-rose-500/30"
                    : agreedToTerms
                    ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-hairline-hover)]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="agree_to_terms"
                    name="agree_to_terms"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAgreedToTerms(checked);
                      if (checked) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.terms;
                          return copy;
                        });
                      }
                    }}
                    className="mt-0.5 h-4.5 w-4.5 rounded border-[var(--color-hairline)] text-sky-600 focus:ring-sky-500/20 focus:ring-2 focus:ring-offset-0 cursor-pointer accent-sky-600 shrink-0"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="agree_to_terms"
                      className="text-[11px] sm:text-xs text-[var(--color-mute)] leading-relaxed cursor-pointer block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      I have read and agree to the{" "}
                      <Link
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sky-600 dark:text-sky-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sky-600 dark:text-sky-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </Link>
                      .
                    </label>
                    {fieldErrors.terms && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle size={12} className="shrink-0" />
                        {fieldErrors.terms}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit CTA Button with validation feedback & double-click guard */}
              <div className="pt-0.5">
                <FormSubmitButton
                  isReady={isAllMandatoryFilled && isMandatoryReady && !isAnyUploading}
                  loading={pending || isAnyUploading}
                  label={isAnyUploading ? "Uploading Documents..." : "Request Platform Access"}
                  loadingLabel={isAnyUploading ? "Uploading Documents to Secure Storage..." : "Submitting Registration Request..."}
                  missingCount={missingMandatoryList.length}
                  missingFields={missingMandatoryList}
                  showHelperChip={false}
                />
              </div>
            </form>

            {/* Footer */}
            <div className="mt-3.5 pt-3 border-t border-[var(--color-hairline)] flex items-center justify-center gap-1.5 text-xs sm:text-[13px]">
              <span className="text-[var(--color-mute)]">
                Already have an account?
              </span>
              <Link
                href="/login"
                className="font-semibold text-sky-600 dark:text-sky-400 hover:underline transition-colors"
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Minimal Bottom Footer */}
        <div className="w-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono text-[var(--color-mute)] shrink-0 pt-2 pb-1 text-center">
          <span>&copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.</span>
        </div>
      </div>
    </div>
  );
}