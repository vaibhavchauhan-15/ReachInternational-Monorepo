"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertCircle, FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CareersApplyFormProps {
  jobId?: string | null;
  jobTitle?: string;
  onSuccess?: () => void;
}

export function CareersApplyForm({ jobId, jobTitle, onSuccess }: CareersApplyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [totalExpYrs, setTotalExpYrs] = useState<number | "">("");
  const [currentCtc, setCurrentCtc] = useState<number | "">("");
  const [expectedCtc, setExpectedCtc] = useState<number | "">("");
  const [noticePeriod, setNoticePeriod] = useState<number | "">("");
  const [coverNote, setCoverNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Honeypot
  const [honeypot, setHoneypot] = useState("");

  // Errors & UI
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("File exceeds the 5MB size limit. Please upload a smaller PDF or DOCX file.");
      setResumeFile(null);
      return;
    }

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|doc)$/i)) {
      setErrorMessage("Invalid file type. Please upload your resume in PDF or DOCX format.");
      setResumeFile(null);
      return;
    }

    setErrorMessage(null);
    setResumeFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Client-side quick checks
    if (!resumeFile) {
      setErrorMessage("Please upload your resume (PDF or DOCX, max 5MB).");
      return;
    }

    if (!consent) {
      setErrorMessage("You must agree to the data storage terms to submit your application.");
      return;
    }

    const formData = new FormData();
    if (jobId) formData.append("job_id", jobId);
    formData.append("full_name", fullName);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("current_city", currentCity);
    formData.append("total_experience_yrs", String(totalExpYrs));
    if (currentCtc !== "") formData.append("current_ctc", String(currentCtc));
    if (expectedCtc !== "") formData.append("expected_ctc", String(expectedCtc));
    if (noticePeriod !== "") formData.append("notice_period_days", String(noticePeriod));
    if (coverNote.trim()) formData.append("cover_note", coverNote.trim());
    formData.append("consent", "true");
    formData.append("consent_version", "2026-10");
    formData.append("resume", resumeFile);
    if (honeypot) formData.append("website", honeypot);

    startTransition(async () => {
      try {
        const response = await fetch("/api/careers/apply", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push("/careers/apply/success");
          }
        } else {
          setErrorMessage(data.error || "Submission failed. Please check your information.");
          if (data.fieldErrors) {
            const mapped: Record<string, string> = {};
            for (const [k, v] of Object.entries(data.fieldErrors)) {
              if (Array.isArray(v) && v[0]) mapped[k] = v[0];
            }
            setFieldErrors(mapped);
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Network error. Please try submitting again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot field (hidden from real users) */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {jobTitle && (
        <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
          Applying for: <span className="font-bold text-foreground">{jobTitle}</span>
        </div>
      )}

      {/* Grid of basic fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className="w-full h-10 px-3.5 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20"
          />
          {fieldErrors.full_name && (
            <p className="text-[11px] text-red-500">{fieldErrors.full_name}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. ramesh.kumar@example.com"
            className="w-full h-10 px-3.5 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20"
          />
          {fieldErrors.email && (
            <p className="text-[11px] text-red-500">{fieldErrors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Mobile Number (10-digit Indian) <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1.5 h-10 px-3 text-xs rounded-xl bg-muted/40 border border-border">
            <span className="text-muted-foreground font-mono font-medium">+91</span>
            <input
              type="tel"
              required
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="9876543210"
              className="flex-1 bg-transparent text-foreground focus:outline-none font-mono"
            />
          </div>
          {fieldErrors.phone && (
            <p className="text-[11px] text-red-500">{fieldErrors.phone}</p>
          )}
        </div>

        {/* Current City */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Current City / Town <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={currentCity}
            onChange={(e) => setCurrentCity(e.target.value)}
            placeholder="e.g. Delhi NCR, Ahmedabad, Pune"
            className="w-full h-10 px-3.5 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20"
          />
          {fieldErrors.current_city && (
            <p className="text-[11px] text-red-500">{fieldErrors.current_city}</p>
          )}
        </div>

        {/* Total Experience */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Total Experience (Years) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="50"
            required
            value={totalExpYrs}
            onChange={(e) => setTotalExpYrs(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g. 4.5"
            className="w-full h-10 px-3.5 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20 font-mono"
          />
          {fieldErrors.total_experience_yrs && (
            <p className="text-[11px] text-red-500">{fieldErrors.total_experience_yrs}</p>
          )}
        </div>

        {/* Notice Period */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Notice Period (Days)
          </label>
          <input
            type="number"
            min="0"
            max="180"
            value={noticePeriod}
            onChange={(e) => setNoticePeriod(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0 for immediate joiners"
            className="w-full h-10 px-3.5 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20 font-mono"
          />
        </div>

        {/* Current CTC */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Current Salary / CTC (₹ / Month or Year)
          </label>
          <input
            type="number"
            min="0"
            value={currentCtc}
            onChange={(e) => setCurrentCtc(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Optional"
            className="w-full h-10 px-3.5 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20 font-mono"
          />
        </div>

        {/* Expected CTC */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Expected Salary / CTC (₹ / Month or Year)
          </label>
          <input
            type="number"
            min="0"
            value={expectedCtc}
            onChange={(e) => setExpectedCtc(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Optional"
            className="w-full h-10 px-3.5 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20 font-mono"
          />
        </div>
      </div>

      {/* Resume File Upload Dropzone */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">
          Upload Resume (PDF or DOCX, max 5MB) <span className="text-red-500">*</span>
        </label>
        <div
          className={cn(
            "p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer",
            resumeFile
              ? "border-[#008CFC] bg-sky-500/5 text-foreground"
              : "border-border hover:border-[#008CFC]/60 bg-muted/20"
          )}
          onClick={() => document.getElementById("resume-input")?.click()}
        >
          <input
            id="resume-input"
            type="file"
            accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
          />
          {resumeFile ? (
            <div className="flex items-center gap-2.5">
              <FileText className="size-6 text-[#008CFC]" />
              <div className="text-left">
                <span className="text-xs font-bold text-foreground block truncate max-w-[280px]">
                  {resumeFile.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Click to replace
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="size-6 text-[#008CFC] mx-auto" />
              <p className="text-xs font-semibold text-foreground">
                Click to browse or drag and drop your resume
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                PDF or Word Document • Max 5MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cover Note */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground">
          Brief Cover Note or Key Equipment Experience (optional)
        </label>
        <textarea
          rows={3}
          value={coverNote}
          onChange={(e) => setCoverNote(e.target.value)}
          placeholder="Mention key machinery operated (e.g. 40ft Boom Lifts, 10T Forklifts), yard leadership, or certifications..."
          className="w-full p-3 text-xs rounded-xl bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20 leading-relaxed"
        />
      </div>

      {/* Consent Checkbox */}
      <div className="pt-2">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-[#008CFC] focus:ring-[#008CFC]"
          />
          <span className="text-xs text-muted-foreground leading-normal">
            I consent to Reach International processing and securely storing my submitted resume and personal details for recruitment and candidate evaluation purposes in accordance with the Privacy Policy.
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full h-12 rounded-xl font-bold text-sm bg-[#008CFC] text-white hover:bg-[#0070CA] shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
      >
        {isPending ? (
          <span>Submitting Application...</span>
        ) : (
          <>
            <span>Submit Application</span>
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </form>
  );
}
