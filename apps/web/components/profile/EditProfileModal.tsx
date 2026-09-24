"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  useToast,
  Input,
  CustomTimePicker,
} from "@/components/ui";
import {
  AnimatedAlertTriangle,
  AnimatedShieldCheck,
  AnimatedCreditCard,
} from "@/components/ui/animated-icons";
import { CheckCircle2, AlertCircle, FileText, Upload, X, Check, ExternalLink, Trash2 } from "lucide-react";
import { updateMyProfile } from "@/app/actions/profile";
import {
  getUserDocumentsAction,
  confirmDocumentUploadAction,
  deleteDocumentAction,
  type UserDocument,
} from "@/app/actions/documents";
import {
  uploadFileWithProgress,
  validateDocumentFile,
  buildDocumentPath,
} from "@/lib/upload";
import { validateAadhaarNumber, validateLicenseNumber } from "@reachinternational/utils";
import type { User as UserType } from "@/lib/types/database";
import {
  FormSectionCard,
  UserAddressSection,
  UserSalaryField,
  FormSubmitButton,
} from "@/components/forms";

interface EditProfileModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function parseShiftTimes(shiftStr?: string | null): { start: string; end: string } {
  if (!shiftStr) {
    return { start: "08:00 AM", end: "08:00 PM" };
  }
  const matches = shiftStr.match(/\b(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?)\b/g);
  if (matches && matches.length >= 2) {
    const normalize = (t: string) => {
      const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        const h = parseInt(match[1], 10);
        const formattedH = h >= 1 && h <= 12 ? String(h).padStart(2, "0") : String(h % 12 || 12).padStart(2, "0");
        const formattedM = match[2];
        const period = (match[3] || (h >= 12 ? "PM" : "AM")).toUpperCase();
        return `${formattedH}:${formattedM} ${period}`;
      }
      return t.trim();
    };
    return { start: normalize(matches[0]), end: normalize(matches[1]) };
  }
  return { start: "08:00 AM", end: "08:00 PM" };
}

export function EditProfileModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: EditProfileModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(user.full_name || "");
  const [phone, setPhone] = useState(user.phone || "");

  const initialTimes = parseShiftTimes(user.shift_time);
  const [startTime, setStartTime] = useState(initialTimes.start);
  const [endTime, setEndTime] = useState(initialTimes.end);

  const [street, setStreet] = useState(user.street || user.address || "");
  const [address, setAddress] = useState(user.address || user.street || "");
  const [city, setCity] = useState(user.city || "");
  const [district, setDistrict] = useState(user.district || "");
  const [stateName, setStateName] = useState(user.state || "Maharashtra");
  const [stateId, setStateId] = useState<number | undefined>(user.state_id || 27);
  const [monthlySalary, setMonthlySalary] = useState(
    user.monthly_salary !== null && user.monthly_salary !== undefined ? String(user.monthly_salary) : ""
  );
  const [aadhaarNumber, setAadhaarNumber] = useState(user.aadhaar_number || "");
  const [licenseNumber, setLicenseNumber] = useState(user.license_number || "");

  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  // Document state
  const [existingDocs, setExistingDocs] = useState<UserDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Per-type upload state
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [aadhaarPreviewUrl, setAadhaarPreviewUrl] = useState<string | null>(null);
  const [aadhaarProgress, setAadhaarProgress] = useState(0);
  const [aadhaarUploading, setAadhaarUploading] = useState(false);
  const [aadhaarUploadError, setAadhaarUploadError] = useState<string | null>(null);

  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreviewUrl, setLicensePreviewUrl] = useState<string | null>(null);
  const [licenseProgress, setLicenseProgress] = useState(0);
  const [licenseUploading, setLicenseUploading] = useState(false);
  const [licenseUploadError, setLicenseUploadError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!user?.id) return;
    setLoadingDocs(true);
    try {
      const docs = await getUserDocumentsAction(user.id);
      setExistingDocs(docs);
    } catch {
      // ignore
    } finally {
      setLoadingDocs(false);
    }
  }, [user?.id]);

  // Sync state when modal opens or user prop updates
  useEffect(() => {
    if (isOpen) {
      setFullName(user.full_name || "");
      setPhone(user.phone || "");
      const times = parseShiftTimes(user.shift_time);
      setStartTime(times.start);
      setEndTime(times.end);
      setStreet(user.street || user.address || "");
      setAddress(user.address || user.street || "");
      setCity(user.city || "");
      setDistrict(user.district || "");
      setStateName(user.state || "Maharashtra");
      setStateId(user.state_id || 27);
      setMonthlySalary(
        user.monthly_salary !== null && user.monthly_salary !== undefined ? String(user.monthly_salary) : ""
      );
      setAadhaarNumber(user.aadhaar_number || "");
      setLicenseNumber(user.license_number || "");
      setAadhaarError(null);
      setLicenseError(null);

      setAadhaarFile(null);
      setAadhaarPreviewUrl(null);
      setAadhaarUploadError(null);
      setLicenseFile(null);
      setLicensePreviewUrl(null);
      setLicenseUploadError(null);

      loadDocuments();
    }
  }, [isOpen, user, loadDocuments]);

  const handleUploadDoc = async (code: "aadhaar" | "driving_license", file: File) => {
    if (code === "aadhaar") {
      setAadhaarUploading(true);
      setAadhaarProgress(0);
      setAadhaarUploadError(null);
    } else {
      setLicenseUploading(true);
      setLicenseProgress(0);
      setLicenseUploadError(null);
    }

    try {
      const storagePath = buildDocumentPath(user.id, code, file);
      await uploadFileWithProgress(
        "user_files",
        storagePath,
        file,
        (percent) => {
          if (code === "aadhaar") setAadhaarProgress(percent);
          else setLicenseProgress(percent);
        }
      );

      const confirmRes = await confirmDocumentUploadAction({
        documentTypeCode: code,
        storagePath,
        mimeType: file.type,
        fileSizeBytes: file.size,
      });

      if (!confirmRes.success) {
        throw new Error(confirmRes.error || "Failed to register document");
      }

      toast("success", `${code === "aadhaar" ? "Aadhaar" : "Licence"} document uploaded successfully`);
      if (code === "aadhaar") {
        setAadhaarFile(null);
        setAadhaarPreviewUrl(null);
      } else {
        setLicenseFile(null);
        setLicensePreviewUrl(null);
      }
      await loadDocuments();
    } catch (err: any) {
      const msg = err?.message || "Upload failed";
      if (code === "aadhaar") setAadhaarUploadError(msg);
      else setLicenseUploadError(msg);
      toast("error", msg);
    } finally {
      if (code === "aadhaar") setAadhaarUploading(false);
      else setLicenseUploading(false);
    }
  };

  const handleDeleteDoc = async (code: "aadhaar" | "driving_license") => {
    try {
      const res = await deleteDocumentAction(code);
      if (res.success) {
        toast("success", `${code === "aadhaar" ? "Aadhaar" : "Licence"} document removed`);
        await loadDocuments();
      } else {
        toast("error", res.error || "Failed to remove document");
      }
    } catch {
      toast("error", "Failed to remove document");
    }
  };


  const handleAadhaarChange = (val: string) => {
    setAadhaarNumber(val);
    if (!val.trim()) {
      setAadhaarError(null);
      return;
    }
    const res = validateAadhaarNumber(val);
    if (!res.isValid) {
      setAadhaarError(res.error || "Invalid Aadhaar format");
    } else {
      setAadhaarError(null);
    }
  };

  const handleLicenseChange = (val: string) => {
    const upper = val.toUpperCase();
    setLicenseNumber(upper);
    if (!upper.trim()) {
      setLicenseError(null);
      return;
    }
    const res = validateLicenseNumber(upper);
    if (!res.isValid) {
      setLicenseError(res.error || "Invalid licence format");
    } else {
      setLicenseError(null);
    }
  };

  const isSuperAdmin = user.role === "super_admin";
  const isOperator = user.role === "operator";
  const approverHierarchyLabel =
    user.role === "admin"
      ? "Super Administrator"
      : ["manager", "hr"].includes(user.role)
      ? "Administrator"
      : "Manager / Administrator";

  // Section 1: Personal Details (Mandatory)
  const section1Complete = Boolean(
    fullName.trim().length >= 2 &&
    phone.replace(/\D/g, "").length >= 10 &&
    !aadhaarError &&
    !licenseError
  );

  // Section 2: Shift Timing (Mandatory)
  const section2Complete = Boolean(startTime.trim() && endTime.trim());

  // Section 3: Work Location & Address (Mandatory)
  const section3Complete = Boolean(
    street.trim() &&
    city.trim() &&
    district.trim() &&
    (stateName.trim() || stateId)
  );

  // Section 4: Compensation (Mandatory for operator if super_admin; always valid for others / read-only)
  const section4Complete = isSuperAdmin && isOperator ? Boolean(monthlySalary && Number(monthlySalary) > 0) : true;

  const isAllMandatoryFilled =
    section1Complete &&
    section2Complete &&
    section3Complete &&
    section4Complete;

  const missingMandatoryCount =
    (section1Complete ? 0 : 1) +
    (section2Complete ? 0 : 1) +
    (section3Complete ? 0 : 1) +
    (section4Complete ? 0 : 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast("error", "Full name is required.");
      return;
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      toast("error", "Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!street.trim()) {
      toast("error", "Street / building address is required.");
      return;
    }

    if (!city.trim()) {
      toast("error", "City / Town is required.");
      return;
    }

    if (!district.trim()) {
      toast("error", "District is required.");
      return;
    }

    if (!stateName.trim() && !stateId) {
      toast("error", "State is required.");
      return;
    }

    if (isSuperAdmin && isOperator && (!monthlySalary || Number(monthlySalary) <= 0)) {
      toast("error", "Monthly salary is required for operator accounts.");
      return;
    }

    if (aadhaarNumber.trim()) {
      const aRes = validateAadhaarNumber(aadhaarNumber);
      if (!aRes.isValid) {
        toast("error", aRes.error || "Invalid Aadhaar number.");
        return;
      }
    }

    if (licenseNumber.trim()) {
      const lRes = validateLicenseNumber(licenseNumber);
      if (!lRes.isValid) {
        toast("error", lRes.error || "Invalid driving licence number.");
        return;
      }
    }

    const finalShift =
      startTime.trim() && endTime.trim()
        ? `${startTime.trim()} - ${endTime.trim()}`
        : startTime.trim() || endTime.trim() || "";

    startTransition(async () => {
      const formData = new FormData();
      formData.set("full_name", fullName.trim());
      formData.set("phone", phone.trim());
      formData.set("shift_time", finalShift);
      formData.set("street", street.trim());
      formData.set("address", street.trim());
      formData.set("city", city.trim());
      formData.set("district", district.trim());
      formData.set("state", stateName.trim() || "Maharashtra");
      if (stateId) formData.set("state_id", String(stateId));
      if (monthlySalary) formData.set("monthly_salary", monthlySalary.trim());
      formData.set("aadhaar_number", aadhaarNumber.trim());
      formData.set("license_number", licenseNumber.trim());

      const res = await updateMyProfile(formData);

      if (res.error) {
        toast("error", res.error);
        return;
      }

      if (res.instant) {
        toast("success", res.message || "Profile updated successfully!");
      } else {
        toast("info", res.message || "Profile change request submitted for approval.");
      }

      onSuccess?.();
      onClose();
    });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit Profile"
      description={
        isSuperAdmin
          ? "Update your personal details, shift timings, and official identity documents."
          : `Submit profile changes for authorization by your ${approverHierarchyLabel}.`
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Notice Card explaining approval hierarchy */}
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
            isSuperAdmin
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-300"
              : "bg-sky-500/10 border-sky-500/25 text-sky-900 dark:text-sky-300"
          }`}
        >
          {isSuperAdmin ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
          )}
          <div>
            <span className="font-bold">
              {isSuperAdmin ? "Direct Update Access" : "Administrative Approval Required"}
            </span>
            <p className="mt-0.5 opacity-90">
              {isSuperAdmin
                ? "As a Super Admin, your modifications apply instantly to the database."
                : `Your requested changes will be routed directly to your ${approverHierarchyLabel} for review before updating your active profile.`}
            </p>
          </div>
        </div>

        {/* Section 1: Personal Details */}
        <FormSectionCard
          stepNumber={1}
          title="Personal Details"
          description="Name, contact, and official identification"
          isMandatory={true}
          isCompleted={section1Complete}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="h-10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                required
                maxLength={15}
                className="h-10 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Aadhaar Card Number
              </label>
              <Input
                value={aadhaarNumber}
                onChange={(e) => handleAadhaarChange(e.target.value)}
                placeholder="12-digit Aadhaar Number"
                maxLength={14}
                className={`h-10 font-mono ${
                  aadhaarError ? "border-rose-500 focus:ring-rose-500/30" : ""
                }`}
              />
              {aadhaarError && (
                <p className="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
                  <AnimatedAlertTriangle size={12} />
                  {aadhaarError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Driving Licence Number
              </label>
              <Input
                value={licenseNumber}
                onChange={(e) => handleLicenseChange(e.target.value)}
                placeholder="e.g. MH12 20110012345"
                maxLength={25}
                className={`h-10 font-mono uppercase ${
                  licenseError ? "border-rose-500 focus:ring-rose-500/30" : ""
                }`}
              />
              {licenseError && (
                <p className="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
                  <AnimatedAlertTriangle size={12} />
                  {licenseError}
                </p>
              )}
            </div>
          </div>

          {/* Identity Document Attachments */}
          <div className="pt-2 border-t border-[var(--color-hairline)] space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center justify-between">
              <span>Official Identity Documents (KYC)</span>
              <span className="text-[10px] font-mono font-normal">2 MB max per file</span>
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Aadhaar Card Document */}
              {(() => {
                const existingAadhaar = existingDocs.find((d) => d.document_type_code === "aadhaar");
                return (
                  <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                        <AnimatedShieldCheck size={14} className="text-sky-600 dark:text-sky-400" />
                        Aadhaar Document
                      </span>
                      {existingAadhaar ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          <Check className="h-3 w-3" /> Uploaded
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-mute)]">Not uploaded</span>
                      )}
                    </div>

                    {existingAadhaar && !aadhaarFile && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-[var(--color-ink)] truncate">
                              Aadhaar Card
                            </p>
                            <p className="text-[10px] text-[var(--color-mute)] font-mono">
                              {existingAadhaar.mime_type?.split("/")[1]?.toUpperCase()} · {(existingAadhaar.file_size_bytes / 1024).toFixed(0)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {existingAadhaar.signed_url && (
                            <a
                              href={existingAadhaar.signed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-sky-600 hover:bg-sky-500/10 transition-colors"
                              title="View Document"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc("aadhaar")}
                            className="p-1 rounded text-[var(--color-mute)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {!aadhaarFile ? (
                      <label className="flex items-center justify-center gap-2 p-2 rounded-lg border-2 border-dashed border-[var(--color-hairline)] hover:border-sky-500/50 cursor-pointer transition-colors group">
                        <Upload className="h-3.5 w-3.5 text-[var(--color-mute)] group-hover:text-sky-600 transition-colors" />
                        <span className="text-[11px] text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-colors">
                          {existingAadhaar ? "Replace Aadhaar (JPG, PNG, PDF)" : "Upload Aadhaar (JPG, PNG, PDF)"}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const val = validateDocumentFile(f, ["image/jpeg", "image/png", "application/pdf"], 2097152);
                              if (!val.valid) {
                                toast("error", val.error || "Invalid file");
                              } else {
                                setAadhaarFile(f);
                                if (f.type.startsWith("image/")) setAadhaarPreviewUrl(URL.createObjectURL(f));
                              }
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <div className="space-y-2 p-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                        <div className="flex items-center gap-2">
                          {aadhaarPreviewUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={aadhaarPreviewUrl} alt="Preview" className="h-8 w-8 rounded object-cover border border-[var(--color-hairline)]" />
                          ) : (
                            <FileText className="h-6 w-6 text-sky-600" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-[var(--color-ink)] truncate">{aadhaarFile.name}</p>
                            <p className="text-[10px] text-[var(--color-mute)] font-mono">{(aadhaarFile.size / 1024).toFixed(0)} KB</p>
                          </div>
                          {!aadhaarUploading && (
                            <button
                              type="button"
                              onClick={() => {
                                setAadhaarFile(null);
                                setAadhaarPreviewUrl(null);
                              }}
                              className="p-1 text-[var(--color-mute)] hover:text-rose-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {aadhaarUploading ? (
                          <div className="space-y-1">
                            <div className="h-1.5 w-full bg-[var(--color-hairline)] rounded-full overflow-hidden">
                              <div className="h-full bg-sky-600 transition-all duration-200" style={{ width: `${aadhaarProgress}%` }} />
                            </div>
                            <p className="text-[10px] text-right font-mono text-sky-600">{aadhaarProgress}%</p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => handleUploadDoc("aadhaar", aadhaarFile)}
                            className="w-full h-8 text-[11px] font-bold"
                          >
                            Upload Aadhaar Now
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Driving Licence Document */}
              {(() => {
                const existingLicense = existingDocs.find((d) => d.document_type_code === "driving_license");
                return (
                  <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                        <AnimatedCreditCard size={14} className="text-sky-600 dark:text-sky-400" />
                        Licence Document
                      </span>
                      {existingLicense ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          <Check className="h-3 w-3" /> Uploaded
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-mute)]">Not uploaded</span>
                      )}
                    </div>

                    {existingLicense && !licenseFile && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-[var(--color-ink)] truncate">
                              Driving Licence
                            </p>
                            <p className="text-[10px] text-[var(--color-mute)] font-mono">
                              {existingLicense.mime_type?.split("/")[1]?.toUpperCase()} · {(existingLicense.file_size_bytes / 1024).toFixed(0)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {existingLicense.signed_url && (
                            <a
                              href={existingLicense.signed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-sky-600 hover:bg-sky-500/10 transition-colors"
                              title="View Document"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc("driving_license")}
                            className="p-1 rounded text-[var(--color-mute)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {!licenseFile ? (
                      <label className="flex items-center justify-center gap-2 p-2 rounded-lg border-2 border-dashed border-[var(--color-hairline)] hover:border-sky-500/50 cursor-pointer transition-colors group">
                        <Upload className="h-3.5 w-3.5 text-[var(--color-mute)] group-hover:text-sky-600 transition-colors" />
                        <span className="text-[11px] text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-colors">
                          {existingLicense ? "Replace Licence (JPG, PNG, PDF)" : "Upload Licence (JPG, PNG, PDF)"}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const val = validateDocumentFile(f, ["image/jpeg", "image/png", "application/pdf"], 2097152);
                              if (!val.valid) {
                                toast("error", val.error || "Invalid file");
                              } else {
                                setLicenseFile(f);
                                if (f.type.startsWith("image/")) setLicensePreviewUrl(URL.createObjectURL(f));
                              }
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <div className="space-y-2 p-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                        <div className="flex items-center gap-2">
                          {licensePreviewUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={licensePreviewUrl} alt="Preview" className="h-8 w-8 rounded object-cover border border-[var(--color-hairline)]" />
                          ) : (
                            <FileText className="h-6 w-6 text-sky-600" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-[var(--color-ink)] truncate">{licenseFile.name}</p>
                            <p className="text-[10px] text-[var(--color-mute)] font-mono">{(licenseFile.size / 1024).toFixed(0)} KB</p>
                          </div>
                          {!licenseUploading && (
                            <button
                              type="button"
                              onClick={() => {
                                setLicenseFile(null);
                                setLicensePreviewUrl(null);
                              }}
                              className="p-1 text-[var(--color-mute)] hover:text-rose-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {licenseUploading ? (
                          <div className="space-y-1">
                            <div className="h-1.5 w-full bg-[var(--color-hairline)] rounded-full overflow-hidden">
                              <div className="h-full bg-sky-600 transition-all duration-200" style={{ width: `${licenseProgress}%` }} />
                            </div>
                            <p className="text-[10px] text-right font-mono text-sky-600">{licenseProgress}%</p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => handleUploadDoc("driving_license", licenseFile)}
                            className="w-full h-8 text-[11px] font-bold"
                          >
                            Upload Licence Now
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </FormSectionCard>

        {/* Section 2: Shift Timing */}
        <FormSectionCard
          stepNumber={2}
          title="Shift Timing"
          description="Operating work schedule window"
          isMandatory={true}
          isCompleted={section2Complete}
        >
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <CustomTimePicker
              label="Shift Start Time"
              value={startTime}
              onChange={setStartTime}
              placeholder="08:00 AM"
            />
            <CustomTimePicker
              label="Shift End Time"
              value={endTime}
              onChange={setEndTime}
              placeholder="08:00 PM"
            />
          </div>
        </FormSectionCard>

        {/* Section 3: Work Location & Address */}
        <FormSectionCard
          stepNumber={3}
          title="Work Location & Address"
          description="Street + City/Town/Village + District + State"
          isMandatory={true}
          isCompleted={section3Complete}
        >
          <UserAddressSection
            street={street}
            city={city}
            district={district}
            state={stateName}
            stateId={stateId}
            onChange={(field, val) => {
              if (field === "street") setStreet(val);
              else if (field === "city") setCity(val);
              else if (field === "district") setDistrict(val);
              else if (field === "state") setStateName(val);
              else if (field === "state_id") setStateId(Number(val));
            }}
            required={true}
            idPrefix="profile-edit"
          />
        </FormSectionCard>

        {/* Section 4: Compensation */}
        <FormSectionCard
          stepNumber={4}
          title="Compensation"
          description={isSuperAdmin ? "Monthly base remuneration (Super Admin editable)" : "Verified base monthly compensation"}
          isMandatory={isSuperAdmin && isOperator}
          isCompleted={section4Complete}
        >
          <UserSalaryField
            value={monthlySalary}
            onChange={setMonthlySalary}
            role={user.role}
            readOnly={!isSuperAdmin}
            id="profile-salary"
          />
        </FormSectionCard>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-hairline)]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
            className="h-10 px-4 text-xs font-semibold"
          >
            Cancel
          </Button>
          <div className="min-w-[180px]">
            <FormSubmitButton
              isReady={isAllMandatoryFilled}
              loading={isPending}
              label={isSuperAdmin ? "Save Changes Directly" : "Submit for Approval"}
              loadingLabel="Submitting Profile Changes..."
              missingCount={missingMandatoryCount}
              fullWidth={false}
              size="md"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
