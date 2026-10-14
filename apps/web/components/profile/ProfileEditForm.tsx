"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  useToast,
  Input,
} from "@/components/ui";
import {
  AnimatedUser,
  AnimatedCreditCard,
  AnimatedShieldCheck,
} from "@/components/ui/animated-icons";
import {
  Lock,
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Info,
  FileCheck,
} from "lucide-react";
import { FormSectionCard } from "@/components/forms";
import { UserAddressSection } from "@/components/forms/UserAddressSection";
import { ProfilePendingBanner } from "@/components/profile/ProfilePendingBanner";
import { updateMyProfile } from "@/app/actions/profile";
import { uploadFileWithProgress, validateDocumentFile } from "@/lib/upload";
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  validateBankAccountNumber,
  validateIfscCode,
} from "@reachinternational/utils";
import type { User as UserType, ProfileChangeRequest } from "@/lib/types/database";
import type { UserDocument, DocumentType } from "@/app/actions/documents";

export interface ProfileEditFormProps {
  user: UserType;
  existingDocuments?: UserDocument[];
  documentTypes?: DocumentType[];
  pendingRequest?: ProfileChangeRequest | null;
  isModal?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

interface SelectedDocFile {
  file: File;
  previewUrl?: string;
}

export function ProfileEditForm({
  user,
  existingDocuments = [],
  documentTypes = [],
  pendingRequest = null,
  isModal = false,
  onSuccess,
  onCancel,
  showCancelButton = true,
}: ProfileEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // 1. Personal Information State
  const [fullName, setFullName] = useState(user.full_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [street, setStreet] = useState(user.street || user.address || "");
  const [city, setCity] = useState(user.city || "");
  const [district, setDistrict] = useState(user.district || "");
  const [stateName, setStateName] = useState(user.state || "");
  const [stateId, setStateId] = useState<number | string | null>(user.state_id || null);

  // 2. Banking Details State
  const [bankAccount, setBankAccount] = useState(user.bank_account_number || "");
  const [bankIfsc, setBankIfsc] = useState(user.bank_ifsc_code || "");

  // 3. Identity and Statutory State
  const [aadhaar, setAadhaar] = useState(user.aadhaar_number || "");
  const [license, setLicense] = useState(user.license_number || "");

  // 4. Document Selection State
  const [selectedDocs, setSelectedDocs] = useState<Record<string, SelectedDocFile>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Hidden File Inputs Refs
  const bankDocInputRef = useRef<HTMLInputElement>(null);
  const aadhaarDocInputRef = useRef<HTMLInputElement>(null);
  const licenseDocInputRef = useRef<HTMLInputElement>(null);

  // Errors State
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    setFullName(user.full_name || "");
    setPhone(user.phone || "");
    setEmail(user.email || "");
    setStreet(user.street || user.address || "");
    setCity(user.city || "");
    setDistrict(user.district || "");
    setStateName(user.state || "");
    setStateId(user.state_id || null);
    setBankAccount(user.bank_account_number || "");
    setBankIfsc(user.bank_ifsc_code || "");
    setAadhaar(user.aadhaar_number || "");
    setLicense(user.license_number || "");
    setErrors({});
  }, [user]);

  // Existing documents lookup by type
  const activeDocMap = useMemo(() => {
    const map = new Map<string, UserDocument>();
    existingDocuments.forEach((doc) => {
      map.set(doc.document_type_code, doc);
    });
    return map;
  }, [existingDocuments]);

  // Check if bank details were modified
  const isBankModified = useMemo(() => {
    const originalAccount = (user.bank_account_number || "").trim();
    const originalIfsc = (user.bank_ifsc_code || "").trim().toUpperCase();
    const currentAccount = bankAccount.trim();
    const currentIfsc = bankIfsc.trim().toUpperCase();

    return (
      (Boolean(currentAccount) && currentAccount !== originalAccount) ||
      (Boolean(currentIfsc) && currentIfsc !== originalIfsc)
    );
  }, [bankAccount, bankIfsc, user.bank_account_number, user.bank_ifsc_code]);

  // Check if identity details were modified
  const isIdentityModified = useMemo(() => {
    const origAadhaar = (user.aadhaar_number || "").replace(/\D/g, "");
    const curAadhaar = aadhaar.replace(/\D/g, "");
    const origLic = (user.license_number || "").trim().toUpperCase();
    const curLic = license.trim().toUpperCase();

    return (
      (Boolean(curAadhaar) && curAadhaar !== origAadhaar) ||
      (Boolean(curLic) && curLic !== origLic) ||
      Boolean(selectedDocs.aadhaar) ||
      Boolean(selectedDocs.driving_license)
    );
  }, [aadhaar, license, user.aadhaar_number, user.license_number, selectedDocs]);

  // Validation functions
  const validateField = (field: string, val: string): boolean => {
    const newErrors = { ...errors };

    switch (field) {
      case "full_name": {
        const trimmed = val.trim();
        if (!trimmed) {
          newErrors.full_name = "Full name is required.";
        } else if (trimmed.length < 2) {
          newErrors.full_name = "Full name must be at least 2 characters.";
        } else {
          delete newErrors.full_name;
        }
        break;
      }
      case "phone": {
        const digits = val.replace(/\D/g, "");
        if (!digits) {
          newErrors.phone = "Mobile number is required.";
        } else if (digits.length < 10) {
          newErrors.phone = "Enter a valid 10-digit mobile number.";
        } else {
          delete newErrors.phone;
        }
        break;
      }
      case "email": {
        const trimmed = val.trim();
        if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          newErrors.email = "Enter a valid email address.";
        } else {
          delete newErrors.email;
        }
        break;
      }
      case "street": {
        if (!val.trim()) {
          newErrors.street = "Street address is required.";
        } else {
          delete newErrors.street;
        }
        break;
      }
      case "city": {
        if (!val.trim()) {
          newErrors.city = "City is required.";
        } else {
          delete newErrors.city;
        }
        break;
      }
      case "district": {
        if (!val.trim()) {
          newErrors.district = "District is required.";
        } else {
          delete newErrors.district;
        }
        break;
      }
      case "bank_account_number": {
        if (val.trim()) {
          const res = validateBankAccountNumber(val);
          if (!res.isValid) {
            newErrors.bank_account_number = res.error || "Invalid bank account number.";
          } else {
            delete newErrors.bank_account_number;
          }
        } else {
          delete newErrors.bank_account_number;
        }
        break;
      }
      case "bank_ifsc_code": {
        if (val.trim()) {
          const res = validateIfscCode(val);
          if (!res.isValid) {
            newErrors.bank_ifsc_code = res.error || "Invalid IFSC code.";
          } else {
            delete newErrors.bank_ifsc_code;
          }
        } else {
          delete newErrors.bank_ifsc_code;
        }
        break;
      }
      case "aadhaar_number": {
        if (val.trim()) {
          const res = validateAadhaarNumber(val);
          if (!res.isValid) {
            newErrors.aadhaar_number = res.error || "Invalid Aadhaar number.";
          } else {
            delete newErrors.aadhaar_number;
          }
        } else {
          delete newErrors.aadhaar_number;
        }
        break;
      }
      case "license_number": {
        if (val.trim()) {
          const res = validateLicenseNumber(val);
          if (!res.isValid) {
            newErrors.license_number = res.error || "Invalid driving licence number.";
          } else {
            delete newErrors.license_number;
          }
        } else {
          delete newErrors.license_number;
        }
        break;
      }
    }

    setErrors(newErrors);
    return !newErrors[field];
  };

  const handleFileSelect = (code: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2 MB) and type
    const validation = validateDocumentFile(file, [], 2 * 1024 * 1024);
    if (!validation.valid) {
      toast("error", validation.error || "Invalid file format or file exceeds 2 MB.");
      e.target.value = "";
      return;
    }

    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setSelectedDocs((prev) => ({
      ...prev,
      [code]: { file, previewUrl },
    }));

    // Reset input so re-selecting same file triggers onChange
    e.target.value = "";
  };

  const handleRemoveSelectedFile = (code: string) => {
    setSelectedDocs((prev) => {
      const copy = { ...prev };
      if (copy[code]?.previewUrl) {
        URL.revokeObjectURL(copy[code].previewUrl!);
      }
      delete copy[code];
      return copy;
    });
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (isModal) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 1. Validate personal fields
    const isNameOk = validateField("full_name", fullName);
    const isPhoneOk = validateField("phone", phone);
    const isEmailOk = validateField("email", email);
    const isStreetOk = validateField("street", street);
    const isCityOk = validateField("city", city);
    const isDistrictOk = validateField("district", district);
    const isBankAccOk = validateField("bank_account_number", bankAccount);
    const isIfscOk = validateField("bank_ifsc_code", bankIfsc);
    const isAadhaarOk = validateField("aadhaar_number", aadhaar);
    const isLicOk = validateField("license_number", license);

    if (
      !isNameOk ||
      !isPhoneOk ||
      !isEmailOk ||
      !isStreetOk ||
      !isCityOk ||
      !isDistrictOk ||
      !isBankAccOk ||
      !isIfscOk ||
      !isAadhaarOk ||
      !isLicOk
    ) {
      toast("warning", "Please fix all highlighted validation errors before saving.");
      return;
    }

    // 2. Enforce supporting document requirement for changes to banking information
    if (isBankModified) {
      const hasBankDocSelected = Boolean(selectedDocs.bank_document);
      const hasExistingBankDoc = Boolean(
        activeDocMap.get("bank_document") || activeDocMap.get("bank_passbook")
      );

      if (!hasBankDocSelected && !hasExistingBankDoc) {
        toast(
          "error",
          "Supporting document (Bank passbook or cancelled cheque) is required when updating banking details."
        );
        return;
      }
    }

    // 3. Upload any newly attached replacement documents to Supabase Storage
    const pendingDocumentsPayload: Record<string, any> = {};

    startTransition(async () => {
      try {
        if (Object.keys(selectedDocs).length > 0) {
          setIsUploadingFiles(true);

          for (const [docCode, docItem] of Object.entries(selectedDocs)) {
            const ext = docItem.file.name.split(".").pop()?.toLowerCase() || "bin";
            const storagePath = `documents/${user.id}/${docCode}_pending_${Date.now()}.${ext}`;

            await uploadFileWithProgress(
              "user_files",
              storagePath,
              docItem.file,
              (percent) => {
                setUploadProgress((prev) => ({ ...prev, [docCode]: percent }));
              }
            );

            pendingDocumentsPayload[docCode] = {
              storage_path: storagePath,
              file_name: docItem.file.name,
              file_size_bytes: docItem.file.size,
              mime_type: docItem.file.type,
            };
          }

          setIsUploadingFiles(false);
        }

        // 4. Construct FormData
        const formData = new FormData();
        formData.append("full_name", fullName.trim());
        formData.append("phone", phone.trim());
        if (email.trim()) formData.append("email", email.trim().toLowerCase());
        formData.append("street", street.trim());
        formData.append("address", street.trim());
        formData.append("city", city.trim());
        formData.append("district", district.trim());
        formData.append("state", stateName.trim());
        if (stateId) formData.append("state_id", String(stateId));

        if (bankAccount.trim()) formData.append("bank_account_number", bankAccount.trim());
        if (bankIfsc.trim()) formData.append("bank_ifsc_code", bankIfsc.trim().toUpperCase());
        if (aadhaar.trim()) formData.append("aadhaar_number", aadhaar.trim());
        if (license.trim()) formData.append("license_number", license.trim().toUpperCase());

        if (Object.keys(pendingDocumentsPayload).length > 0) {
          formData.append("pending_documents", JSON.stringify(pendingDocumentsPayload));
        }

        const res = await updateMyProfile(formData);
        if (res.error) {
          toast("error", res.error);
          return;
        }

        toast(
          "success",
          res.message || "Your profile details have been updated successfully."
        );

        if (onSuccess) {
          onSuccess();
        } else if (!isModal) {
          router.push("/profile");
        }
      } catch (err: any) {
        console.error("Profile submit error:", err);
        toast("error", err?.message || "Failed to update profile. Please try again.");
      } finally {
        setIsUploadingFiles(false);
      }
    });
  };

  // Helper render for document upload card
  const renderDocumentCard = (
    code: string,
    title: string,
    description: string,
    inputRef: React.RefObject<HTMLInputElement | null>,
    isMandatoryDoc: boolean = false
  ) => {
    const activeDoc = activeDocMap.get(code);
    const selected = selectedDocs[code];
    const progress = uploadProgress[code] || 0;

    return (
      <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 hover:bg-[var(--color-canvas)] transition-colors space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] flex items-center gap-1.5 flex-wrap">
              <span>{title}</span>
              {isMandatoryDoc && <span className="text-rose-500 font-bold">*</span>}
            </h4>
            <p className="text-[11px] sm:text-xs text-[var(--color-mute)] mt-0.5">
              {description}
            </p>
          </div>

          {/* Active status indicator */}
          {activeDoc ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <CheckCircle2 size={11} />
              <span>Active Approved</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-500/10 text-neutral-500 border border-neutral-500/20 shrink-0">
              <span>Not on file</span>
            </span>
          )}
        </div>

        {/* Currently Active Document info */}
        {activeDoc && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <FileCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[var(--color-ink)] font-mono truncate">
                {activeDoc.storage_path.split("/").pop()}
              </span>
            </div>
            {activeDoc.signed_url && (
              <a
                href={activeDoc.signed_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>View</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Selected replacement file preview */}
        {selected ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-sky-500/30 bg-sky-500/5 dark:bg-sky-500/10">
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <FileText size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />
              <div className="min-w-0 truncate">
                <p className="text-xs font-semibold text-[var(--color-ink)] truncate font-mono">
                  {selected.file.name}
                </p>
                <p className="text-[10px] text-[var(--color-mute)]">
                  {(selected.file.size / 1024).toFixed(0)} KB • Awaiting approval upon save
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveSelectedFile(code)}
              disabled={isPending || isUploadingFiles}
              className="h-7 w-7 p-0 rounded-full hover:bg-rose-500/10 text-[var(--color-mute)] hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <div>
            <input
              type="file"
              ref={inputRef}
              onChange={(e) => handleFileSelect(code, e)}
              accept=".pdf,image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isPending || isUploadingFiles}
              icon={<Upload size={13} className="text-sky-500" />}
              className="w-full h-9 text-xs font-semibold rounded-lg border-dashed border-[var(--color-hairline)] hover:border-sky-500/50 hover:bg-sky-500/5 cursor-pointer transition-all"
            >
              <span>{activeDoc ? "Upload Replacement Document" : "Upload Document"}</span>
            </Button>
          </div>
        )}

        {/* Upload Progress Bar if in flight */}
        {isUploadingFiles && progress > 0 && progress < 100 && (
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-[var(--color-hairline)] rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-[var(--color-mute)] text-right">{progress}%</p>
          </div>
        )}

        {activeDoc && (
          <p className="text-[10px] text-[var(--color-mute)] italic">
            * Existing approved document remains active until replacement is approved by management.
          </p>
        )}
      </div>
    );
  };

  const isSaving = isPending || isUploadingFiles;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ─── 0. Pending Approval Banner ─── */}
      {pendingRequest && (
        <ProfilePendingBanner
          requestId={pendingRequest.id}
          createdAt={pendingRequest.created_at}
          targetApproverRole={pendingRequest.target_approver_role}
        />
      )}

      {/* ─── 1. Personal Information Section ─── */}
      <FormSectionCard
        stepNumber={1}
        title="Personal Information"
        description="Update your basic contact details and residential address. Changes apply immediately upon save."
        icon={<AnimatedUser size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
        isMandatory={true}
        isCompleted={Boolean(fullName.trim().length >= 2 && phone.trim().length >= 10 && street.trim())}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  validateField("full_name", e.target.value);
                }}
                onBlur={() => validateField("full_name", fullName)}
                placeholder="e.g. Rahul Sharma"
                required={true}
                disabled={isSaving}
                error={errors.full_name}
                className="h-10"
              />
            </div>

            <div>
              <Input
                label="Mobile Number"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  validateField("phone", e.target.value);
                }}
                onBlur={() => validateField("phone", phone)}
                placeholder="e.g. 9876543210"
                required={true}
                disabled={isSaving}
                maxLength={15}
                error={errors.phone}
                className="h-10 font-mono"
              />
            </div>

            <div>
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  validateField("email", e.target.value);
                }}
                onBlur={() => validateField("email", email)}
                placeholder="e.g. rahul.sharma@example.com"
                disabled={isSaving}
                error={errors.email}
                className="h-10"
              />
            </div>
          </div>

          {/* Canonical Address Fields */}
          <div className="pt-2 border-t border-[var(--color-hairline)]">
            <h4 className="text-xs font-bold text-[var(--color-ink)] mb-2.5">
              Residential / Work Location Address
            </h4>
            <UserAddressSection
              street={street}
              city={city}
              district={district}
              state={stateName}
              stateId={stateId}
              required={true}
              disabled={isSaving}
              errors={{
                street: errors.street,
                city: errors.city,
                district: errors.district,
                state: errors.state,
              }}
              onChange={(field, val) => {
                if (field === "street") setStreet(val);
                if (field === "city") setCity(val);
                if (field === "district") setDistrict(val);
                if (field === "state") setStateName(val);
                if (field === "state_id") setStateId(val ? Number(val) : null);
                validateField(field, val);
              }}
            />
          </div>
        </div>
      </FormSectionCard>

      {/* ─── 2. Banking Details Section ─── */}
      <FormSectionCard
        stepNumber={2}
        title="Banking Details"
        description="Salary disbursement account. Updates require management review and mandatory supporting documents."
        icon={<AnimatedCreditCard size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
        isMandatory={false}
        isCompleted={Boolean(bankAccount.trim() && bankIfsc.trim())}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Bank Account Number"
                value={bankAccount}
                onChange={(e) => {
                  setBankAccount(e.target.value);
                  validateField("bank_account_number", e.target.value);
                }}
                onBlur={() => validateField("bank_account_number", bankAccount)}
                placeholder="e.g. 123456789012"
                disabled={isSaving}
                error={errors.bank_account_number}
                className="h-10 font-mono"
              />
            </div>

            <div>
              <Input
                label="IFSC Code"
                value={bankIfsc}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setBankIfsc(upper);
                  validateField("bank_ifsc_code", upper);
                }}
                onBlur={() => validateField("bank_ifsc_code", bankIfsc)}
                placeholder="e.g. SBIN0001234"
                disabled={isSaving}
                maxLength={11}
                error={errors.bank_ifsc_code}
                className="h-10 font-mono uppercase"
              />
            </div>
          </div>

          {/* Mandatory Supporting Document Note for Banking */}
          {isBankModified && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Supporting Document Mandatory for Banking Changes</p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  Because you have updated your account number or IFSC code, you must attach a clear copy of your bank passbook or cancelled cheque below.
                </p>
              </div>
            </div>
          )}

          {/* Supporting Document Upload Card */}
          {renderDocumentCard(
            "bank_document",
            "Bank Passbook / Cancelled Cheque Document",
            "Upload passbook front page or cancelled cheque showing account number and IFSC",
            bankDocInputRef,
            isBankModified
          )}
        </div>
      </FormSectionCard>

      {/* ─── 3. Identity and Statutory Details Section ─── */}
      <FormSectionCard
        stepNumber={3}
        title="Identity and Statutory Details"
        description="Official KYC verification records. Modifications require authorization and replace documents once approved."
        icon={<AnimatedShieldCheck size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
        isMandatory={false}
        isCompleted={Boolean(aadhaar.trim() || license.trim())}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Aadhaar Section */}
            <div className="space-y-3 p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/30">
              <Input
                label="Aadhaar Number (12 Digits)"
                value={aadhaar}
                onChange={(e) => {
                  setAadhaar(e.target.value);
                  validateField("aadhaar_number", e.target.value);
                }}
                onBlur={() => validateField("aadhaar_number", aadhaar)}
                placeholder="e.g. 1234 5678 9012"
                disabled={isSaving}
                maxLength={14}
                error={errors.aadhaar_number}
                className="h-10 font-mono"
              />
              {renderDocumentCard(
                "aadhaar",
                "Aadhaar Card Document",
                "Upload a clear front and back copy of your Aadhaar card (PDF/JPG)",
                aadhaarDocInputRef,
                false
              )}
            </div>

            {/* Driving Licence Section */}
            <div className="space-y-3 p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/30">
              <Input
                label="Driving Licence Number"
                value={license}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setLicense(upper);
                  validateField("license_number", upper);
                }}
                onBlur={() => validateField("license_number", license)}
                placeholder="e.g. MH1420110062821"
                disabled={isSaving}
                maxLength={20}
                error={errors.license_number}
                className="h-10 font-mono uppercase"
              />
              {renderDocumentCard(
                "driving_license",
                "Driving Licence Document",
                "Upload driving licence document for vehicle & heavy machinery clearance",
                licenseDocInputRef,
                false
              )}
            </div>
          </div>
        </div>
      </FormSectionCard>

      {/* ─── 4. Company-Managed Operational Details (What users should NOT edit) ─── */}
      <FormSectionCard
        stepNumber={4}
        title="Company-Managed Operational Details"
        description="These operational, contractual, and system fields are controlled exclusively by authorized management and HR."
        icon={<Lock size={16} className="text-neutral-500 shrink-0" />}
        isMandatory={false}
      >
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/50 p-4 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-ink)]">
            <Shield size={14} className="text-sky-600 dark:text-sky-400" />
            <span>Read-Only Administrative Settings</span>
          </div>

          <p className="text-xs text-[var(--color-mute)] leading-relaxed">
            The following fields cannot be modified through Edit Profile. If any of these details require an update, please coordinate with your site supervisor or HR administrator:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">System Role</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">Super Admin / Admin</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Account Status</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">Authorized Admin</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Salary, Daily Rate & OT</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">Authorized Payroll / Management</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Shift Assignment & Timings</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">Operations Management</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Site Supervisor</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">Operations Management</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Working Location / Client Site</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">Operations Management</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Annual PL Quota & Balance</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">HR / Leave Management</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Member Since & Profile Updates</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">System-Generated</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              <p className="text-[11px] text-[var(--color-mute)]">Profile Completion Status</p>
              <p className="font-semibold text-[var(--color-ink)] mt-0.5">System-Calculated</p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
            >
              <span>View full profile summary</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </FormSectionCard>

      {/* ─── Footer Action Buttons ─── */}
      <div className="flex flex-row items-center justify-end gap-3 pt-4 border-t border-[var(--color-hairline)]">
        {showCancelButton && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 sm:flex-initial h-10 min-h-[44px] px-5 text-xs sm:text-sm font-semibold rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] cursor-pointer active:scale-[0.98] transition-all"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isSaving}
          loading={isSaving}
          className="flex-1 sm:flex-initial h-10 min-h-[44px] px-6 text-xs sm:text-sm font-bold rounded-lg cursor-pointer active:scale-[0.98] transition-all"
        >
          {isUploadingFiles
            ? "Uploading Documents..."
            : isPending
            ? "Saving Changes..."
            : isBankModified || isIdentityModified
            ? "Save & Submit for Approval"
            : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
