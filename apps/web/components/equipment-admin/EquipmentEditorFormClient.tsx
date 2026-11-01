"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Sliders,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EquipmentModelWithRelations,
  EquipmentBrand,
  EquipmentCategory,
  EquipmentSpecDefinition,
  PowerType,
  EquipmentStatus,
} from "@reachinternational/types";
import { saveEquipmentAction } from "@/app/actions/equipment";

interface EquipmentEditorFormClientProps {
  initialModel?: EquipmentModelWithRelations | null;
  brands: EquipmentBrand[];
  categories: EquipmentCategory[];
  specDefinitions: EquipmentSpecDefinition[];
}

export function EquipmentEditorFormClient({
  initialModel,
  brands,
  categories,
  specDefinitions,
}: EquipmentEditorFormClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "basics" | "specs" | "media" | "documents" | "publish"
  >("basics");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form State
  const [modelName, setModelName] = useState(initialModel?.model_name || "");
  const [modelNumber, setModelNumber] = useState(initialModel?.model_number || "");
  const [slug, setSlug] = useState(initialModel?.slug || "");
  const [brandId, setBrandId] = useState(initialModel?.brand_id || brands[0]?.id || "");
  const [categoryId, setCategoryId] = useState(initialModel?.category_id || categories[0]?.id || "");
  const [power, setPower] = useState<PowerType>(initialModel?.power || "electric");
  const [subtype, setSubtype] = useState(initialModel?.subtype || "");
  const [tagline, setTagline] = useState(initialModel?.tagline || "");
  const [summary, setSummary] = useState(initialModel?.summary || initialModel?.short_description || "");
  const [fullDescription, setFullDescription] = useState(initialModel?.full_description || "");
  const [primaryImageUrl, setPrimaryImageUrl] = useState(
    initialModel?.primary_image_url || "/images/awp_scissor_lift.jpg"
  );
  const [coverPath, setCoverPath] = useState(initialModel?.cover_path || "");

  // Toggles
  const [isFeatured, setIsFeatured] = useState(initialModel?.is_featured || false);
  const [rentalAvailable, setRentalAvailable] = useState(initialModel?.rental_available ?? true);
  const [purchaseAvailable, setPurchaseAvailable] = useState(initialModel?.purchase_available ?? true);
  const [indoorUse, setIndoorUse] = useState(initialModel?.indoor_use ?? true);
  const [outdoorUse, setOutdoorUse] = useState(initialModel?.outdoor_use ?? false);
  const [status, setStatus] = useState<EquipmentStatus>(initialModel?.status || "draft");

  // Arrays
  const [features, setFeatures] = useState<string[]>(
    initialModel?.features && initialModel.features.length > 0
      ? initialModel.features
      : ["Proportional joystick control", "Automatic pothole protection system"]
  );
  const [applications, setApplications] = useState<string[]>(
    initialModel?.applications && initialModel.applications.length > 0
      ? initialModel.applications
      : ["Industrial Warehousing", "Commercial Facility Maintenance"]
  );
  const [tags, setTags] = useState<string[]>(
    initialModel?.tags && initialModel.tags.length > 0
      ? initialModel.tags
      : ["electric", "access-platform", "scissor-lift"]
  );

  // Specifications state
  const [unitMode, setUnitMode] = useState<"metric" | "imperial">("metric");
  const [specs, setSpecs] = useState<Record<string, { v: any; d?: string }>>(
    (initialModel?.specs as Record<string, { v: any; d?: string }>) || {
      max_platform_height_m: { v: 8.1, d: "8.1 m / 26'6\"" },
      max_working_height_m: { v: 10.1, d: "10.1 m / 32'6\"" },
      platform_capacity_kg: { v: 250, d: "250 kg / 550 lb" },
      weight_kg: { v: 2062, d: "2,062 kg / 4,546 lb" },
    }
  );

  // SEO
  const [seoTitle, setSeoTitle] = useState(initialModel?.seo_title || "");
  const [seoDescription, setSeoDescription] = useState(initialModel?.seo_description || "");

  // Auto-slug generation from modelName
  function handleNameChange(name: string) {
    setModelName(name);
    if (!initialModel) {
      const generatedSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug);
    }
  }

  // Feature / App / Tag helpers
  function addFeature(text: string) {
    if (text.trim()) setFeatures([...features, text.trim()]);
  }
  function removeFeature(index: number) {
    setFeatures(features.filter((_, i) => i !== index));
  }
  function addApplication(text: string) {
    if (text.trim()) setApplications([...applications, text.trim()]);
  }
  function removeApplication(index: number) {
    setApplications(applications.filter((_, i) => i !== index));
  }
  function addTag(text: string) {
    if (text.trim() && !tags.includes(text.trim())) setTags([...tags, text.trim().toLowerCase()]);
  }
  function removeTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  // Spec updater
  function updateSpecValue(key: string, v: any, d?: string) {
    setSpecs((prev) => ({
      ...prev,
      [key]: { v, d },
    }));
  }

  // Completeness Checklist
  const checklist = [
    { label: "Model Name provided", pass: Boolean(modelName.trim()) },
    { label: "Model Number provided", pass: Boolean(modelNumber.trim()) },
    { label: "Valid Slug formatted", pass: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) },
    { label: "Brand & Category selected", pass: Boolean(brandId && categoryId) },
    { label: "Summary filled (≥10 chars)", pass: summary.trim().length >= 10 },
    { label: "Description filled", pass: fullDescription.trim().length >= 10 },
    { label: "Primary Image URL assigned", pass: Boolean(primaryImageUrl.trim()) },
    { label: "Working Height spec set", pass: Boolean(specs.max_platform_height_m?.v || specs.max_working_height_m?.v) },
  ];
  const allChecksPass = checklist.every((c) => c.pass);

  // Submit Handler
  async function handleSubmit(saveStatus = status) {
    setStatusMessage(null);

    const payload = {
      id: initialModel?.id,
      brand_id: brandId,
      category_id: categoryId,
      model_name: modelName,
      model_number: modelNumber,
      slug,
      power,
      status: saveStatus,
      subtype: subtype || null,
      tagline: tagline || null,
      summary: summary || null,
      full_description: fullDescription || summary,
      description_md: fullDescription || summary,
      primary_image_url: primaryImageUrl,
      cover_path: coverPath || primaryImageUrl,
      is_featured: isFeatured,
      rental_available: rentalAvailable,
      purchase_available: purchaseAvailable,
      indoor_use: indoorUse,
      outdoor_use: outdoorUse,
      features,
      applications,
      tags,
      specs,
      max_platform_height_m: specs.max_platform_height_m?.v ? Number(specs.max_platform_height_m.v) : null,
      max_working_height_m: specs.max_working_height_m?.v ? Number(specs.max_working_height_m.v) : null,
      capacity_kg: specs.platform_capacity_kg?.v ? Number(specs.platform_capacity_kg.v) : null,
      weight_kg: specs.weight_kg?.v ? Number(specs.weight_kg.v) : null,
      seo_title: seoTitle || undefined,
      seo_description: seoDescription || undefined,
      version: initialModel?.version || 1,
    };

    startTransition(async () => {
      const res = await saveEquipmentAction(payload);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Machine ${saveStatus === "published" ? "published" : "saved"} successfully.`,
        });
        if (!initialModel && res.id) {
          router.push(`/marketing/equipment/${res.id}`);
        } else {
          router.refresh();
        }
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to save machine." });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Save Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-3">
          <Link
            href="/marketing/equipment"
            className="p-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
                {initialModel ? initialModel.model_name : "Create New Equipment"}
              </h1>
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                  status === "published" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                  status === "draft" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                  status === "archived" && "bg-neutral-500/10 text-neutral-600 border-neutral-500/20"
                )}
              >
                {status}
              </span>
            </div>
            <p className="text-xs text-[var(--color-mute)]">
              {initialModel ? `Version ${initialModel.version} • Last updated ${new Date(initialModel.updated_at).toLocaleDateString()}` : "New machine draft configuration"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {initialModel && (
            <a
              href={`/equipment`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] transition-colors"
            >
              <Eye size={14} />
              <span>Preview</span>
            </a>
          )}

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit("draft")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit("published")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all disabled:opacity-50"
          >
            <CheckCircle size={14} />
            <span>{status === "published" ? "Update Published" : "Publish Now"}</span>
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={cn(
            "p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border",
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
          )}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Editor Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl w-fit">
        {[
          { key: "basics", label: "Basics & Overview", icon: FileText },
          { key: "specs", label: "Technical Specs", icon: Sliders },
          { key: "media", label: "Photos & Media", icon: ImageIcon },
          { key: "documents", label: "Datasheets & PDFs", icon: FileText },
          { key: "publish", label: "Publish & SEO", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none",
                isActive
                  ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
              )}
            >
              <Icon size={14} className={isActive ? "text-sky-600 dark:text-sky-400" : ""} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BASICS */}
      {activeTab === "basics" && (
        <div className="space-y-6">
          <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Primary Machine Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  Model Commercial Name *
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. JCB S2632E Electric Scissor Lift"
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  Model Number / Designation *
                </label>
                <input
                  type="text"
                  value={modelNumber}
                  onChange={(e) => setModelNumber(e.target.value)}
                  placeholder="e.g. S2632E"
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="e.g. jcb-s2632e"
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs font-mono text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  Subtype Classification
                </label>
                <input
                  type="text"
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  placeholder="e.g. Electric Slab Scissor"
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  Brand / Manufacturer *
                </label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  Category *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  Power Source *
                </label>
                <select
                  value={power}
                  onChange={(e) => setPower(e.target.value as PowerType)}
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="electric">Electric (Battery DC / Lithium)</option>
                  <option value="diesel">Diesel (Internal Combustion)</option>
                  <option value="hybrid">Hybrid (Dual System)</option>
                  <option value="bi_energy">Bi-Energy</option>
                  <option value="manual">Manual / Mechanical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                  Marketing Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Compact 8.1 m electric scissor for indoor work"
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Concise Summary (Cards & Meta) *
              </label>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="1-2 sentences summarizing the machine specifications and key applications..."
                className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Full Description (Markdown supported) *
              </label>
              <textarea
                rows={6}
                value={fullDescription}
                onChange={(e) => setFullDescription(e.target.value)}
                placeholder="Comprehensive technical overview, chassis engineering, hydraulic system, and productivity benefits..."
                className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs font-mono text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20 leading-relaxed"
              />
            </div>
          </div>

          {/* Availability & Environment Toggles */}
          <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Offering & Environment Scope</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rentalAvailable}
                  onChange={(e) => setRentalAvailable(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-[var(--color-ink)]">For Rent</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={purchaseAvailable}
                  onChange={(e) => setPurchaseAvailable(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-[var(--color-ink)]">For Sale</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={indoorUse}
                  onChange={(e) => setIndoorUse(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-[var(--color-ink)]">Indoor Rated</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={outdoorUse}
                  onChange={(e) => setOutdoorUse(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-[var(--color-ink)]">Outdoor Rated</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-semibold text-[var(--color-ink)]">Featured</span>
              </label>
            </div>
          </div>

          {/* Features & Applications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Features */}
            <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">Key Machine Features</h3>
              <div className="space-y-2">
                {features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-mute)] font-mono">{idx + 1}.</span>
                    <input
                      type="text"
                      value={feat}
                      onChange={(e) => {
                        const copy = [...features];
                        copy[idx] = e.target.value;
                        setFeatures(copy);
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg text-xs text-[var(--color-ink)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(idx)}
                      className="text-neutral-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addFeature("New key specification highlight")}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 pt-1"
              >
                <Plus size={13} /> Add Feature Bullet
              </button>
            </div>

            {/* Applications */}
            <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">Primary Target Applications</h3>
              <div className="space-y-2">
                {applications.map((app, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-mute)] font-mono">{idx + 1}.</span>
                    <input
                      type="text"
                      value={app}
                      onChange={(e) => {
                        const copy = [...applications];
                        copy[idx] = e.target.value;
                        setApplications(copy);
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg text-xs text-[var(--color-ink)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeApplication(idx)}
                      className="text-neutral-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addApplication("Facility Upgrades & MEP Installation")}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 pt-1"
              >
                <Plus size={13} /> Add Application Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SPECIFICATIONS */}
      {activeTab === "specs" && (
        <div className="space-y-6">
          <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">Technical Specifications Catalogue</h3>
                <p className="text-xs text-[var(--color-mute)]">
                  Datasheet specification fields with raw metric values and verbatim display overrides.
                </p>
              </div>

              {/* Unit Toggle */}
              <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl">
                <button
                  type="button"
                  onClick={() => setUnitMode("metric")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors",
                    unitMode === "metric"
                      ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  )}
                >
                  Metric (m, kg)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitMode("imperial")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors",
                    unitMode === "imperial"
                      ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  )}
                >
                  Imperial (ft, lb)
                </button>
              </div>
            </div>

            {/* Spec inputs table */}
            <div className="space-y-3 pt-2">
              {[
                { key: "max_platform_height_m", label: "Max. Platform Height", unit: "m", placeholder: "8.1" },
                { key: "max_working_height_m", label: "Max. Working Height", unit: "m", placeholder: "10.1" },
                { key: "extension_outreach_m", label: "Extension Deck Outreach", unit: "m", placeholder: "0.9" },
                { key: "length_stowed_m", label: "Length (Stowed)", unit: "m", placeholder: "2.39" },
                { key: "width_stowed_m", label: "Width (Stowed)", unit: "m", placeholder: "0.81" },
                { key: "height_stowed_rails_folded_m", label: "Height (Rails Folded)", unit: "m", placeholder: "1.96" },
                { key: "height_stowed_rails_unfolded_m", label: "Height (Rails Unfolded)", unit: "m", placeholder: "2.35" },
                { key: "weight_kg", label: "Machine Operating Weight", unit: "kg", placeholder: "2062" },
                { key: "platform_capacity_kg", label: "Platform Safe Working Load", unit: "kg", placeholder: "250" },
                { key: "extension_deck_capacity_kg", label: "Extension Deck Capacity", unit: "kg", placeholder: "120" },
                { key: "occupants_indoor", label: "Max Occupants (Indoor)", unit: "persons", placeholder: "2" },
                { key: "side_force_indoor_n", label: "Side Force (Indoor)", unit: "N", placeholder: "400" },
                { key: "ground_clearance_m", label: "Ground Clearance (Stowed)", unit: "m", placeholder: "0.1" },
                { key: "wheelbase_m", label: "Wheelbase", unit: "m", placeholder: "1.85" },
                { key: "turning_radius_outside_m", label: "Turning Radius (Outside)", unit: "m", placeholder: "2.1" },
                { key: "gradeability_pct", label: "Gradeability", unit: "%", placeholder: "25" },
                { key: "speed_stowed_kmh", label: "Driving Speed (Stowed)", unit: "km/h", placeholder: "3.2" },
                { key: "hydraulic_volume_l", label: "Hydraulic Fluid Volume", unit: "L", placeholder: "18" },
                { key: "battery_ah", label: "Battery Amp-Hours", unit: "Ah", placeholder: "225" },
              ].map((specDef) => {
                const current = specs[specDef.key] || { v: "", d: "" };
                const isNull = current.v === null;

                return (
                  <div
                    key={specDef.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]"
                  >
                    <div className="sm:w-1/3">
                      <span className="text-xs font-bold text-[var(--color-ink)] block">
                        {specDef.label}
                      </span>
                      <span className="text-[10px] text-[var(--color-mute)] font-mono">
                        Key: {specDef.key} ({specDef.unit})
                      </span>
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        disabled={isNull}
                        value={isNull ? "" : current.v ?? ""}
                        onChange={(e) => updateSpecValue(specDef.key, e.target.value, current.d)}
                        placeholder={`Value (${specDef.placeholder})`}
                        className="w-32 px-2.5 py-1.5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-lg text-xs font-mono text-[var(--color-ink)] disabled:opacity-40"
                      />

                      <input
                        type="text"
                        value={current.d || ""}
                        onChange={(e) => updateSpecValue(specDef.key, current.v, e.target.value)}
                        placeholder="Exact datasheet text override (e.g. 8.1 m / 26'6&quot;)"
                        className="flex-1 px-2.5 py-1.5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-lg text-xs text-[var(--color-ink)]"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          updateSpecValue(
                            specDef.key,
                            isNull ? specDef.placeholder : null,
                            isNull ? undefined : "Not rated"
                          )
                        }
                        className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors shrink-0",
                          isNull
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border-[var(--color-hairline)]"
                        )}
                      >
                        {isNull ? "Not Rated" : "N/A"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEDIA */}
      {activeTab === "media" && (
        <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-ink)]">Machine Visual Assets</h3>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
              Primary Hero Image URL *
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={primaryImageUrl}
                onChange={(e) => setPrimaryImageUrl(e.target.value)}
                placeholder="/images/awp_scissor_lift.jpg or Supabase storage URL"
                className="flex-1 px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)]"
              />
              <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-[var(--color-hairline)] shrink-0 bg-neutral-100 dark:bg-neutral-900">
                {primaryImageUrl && (
                  <Image src={primaryImageUrl} alt="Preview" fill className="object-cover" />
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 text-center">
            <ImageIcon size={28} className="mx-auto text-[var(--color-mute)] mb-2" />
            <p className="text-xs font-bold text-[var(--color-ink)]">Supabase Storage Bucket: equipment_media</p>
            <p className="text-[11px] text-[var(--color-mute)] mt-1">
              High-resolution machine photos uploaded here are automatically cached at the edge.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-ink)]">Technical Documents & Brochures</h3>
          <p className="text-xs text-[var(--color-mute)]">
            Datasheets and user brochures available for public download on the machine detail page.
          </p>

          <div className="p-4 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 text-center">
            <FileText size={28} className="mx-auto text-[var(--color-mute)] mb-2" />
            <p className="text-xs font-bold text-[var(--color-ink)]">Supabase Storage Bucket: equipment_docs</p>
            <p className="text-[11px] text-[var(--color-mute)] mt-1">
              Store manufacturer PDF spec sheets (up to 25MB) with automatic public download links.
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: PUBLISH & SEO */}
      {activeTab === "publish" && (
        <div className="space-y-6">
          {/* Completeness Checklist */}
          <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Publication Completeness Audit</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {checklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs"
                >
                  {item.pass ? (
                    <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle size={15} className="text-amber-500 shrink-0" />
                  )}
                  <span className={item.pass ? "text-[var(--color-ink)] font-semibold" : "text-[var(--color-mute)]"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SEO Metadata */}
          <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Search Engine Optimization (SEO)</h3>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Custom Title Tag
              </label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={`${modelName || "Machine"} — Access Equipment Rental | Reach International`}
                className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Meta Description
              </label>
              <textarea
                rows={2}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="High-converting search snippet description..."
                className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)]"
              />
            </div>

            {/* Google SERP Snippet Preview */}
            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--color-mute)] block">
                https://www.reachinternational.co.in › equipment › {slug || "slug"}
              </span>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                {seoTitle || `${modelName || "Equipment Model"} | Reach International`}
              </p>
              <p className="text-xs text-[var(--color-mute)] line-clamp-2">
                {seoDescription || summary || "Explore verified access platform rental and purchase across India."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
