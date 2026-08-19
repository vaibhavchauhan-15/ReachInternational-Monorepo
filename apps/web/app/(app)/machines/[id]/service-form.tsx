"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  AnimatedCamera,
  AnimatedCheck,
  AnimatedPlus,
  AnimatedTrash,
  AnimatedSparkles,
  AnimatedLoader,
  AnimatedCalendarClock,
} from "@/components/ui/animated-icons";
import { Button, Modal, useToast } from "@/components/ui";
import { completeService } from "@/app/actions/services";
import { motion } from "framer-motion";

interface ServiceFormProps {
  machineId: string;
  engineerId: string;
}

const PRESET_TAGS = [
  "🔧 Routine Inspection Completed",
  "🛢️ Oil & Filter Replaced",
  "💨 Air Filter Cleaned",
  "⚡ Electrical Safety Checked",
  "⚙️ Calibration & Testing OK",
  "✨ General Machine Cleaning",
  "⚠️ Minor Wear Noted",
];

export function ServiceForm({ machineId, engineerId }: ServiceFormProps) {
  const { toast } = useToast();
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [isPending, startTransition] = useTransition();

  const handleAddPresetTag = (tag: string) => {
    if (notes.includes(tag)) return;
    setNotes((prev) => (prev ? `${prev}\n• ${tag}` : `• ${tag}`));
    toast("info", "Tag Added", `Added "${tag}" to service notes.`);
  };

  const addPhoto = () => {
    if (photoUrl) {
      setPhotos([...photos, photoUrl]);
      setPhotoUrl("");
      setShowPhotoModal(false);
      toast("info", "Photo Added", "Image link attached to service log.");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await completeService(formData);
        toast(
          "success",
          "Service Logged Successfully! 🎉",
          "Machine next due date and service history have been updated."
        );
      } catch (err) {
        toast(
          "error",
          "Error Completing Service",
          err instanceof Error ? err.message : "Something went wrong."
        );
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
        <input type="hidden" name="machine_id" value={machineId} />
        <input type="hidden" name="engineer_id" value={engineerId} />
        <input type="hidden" name="photo_urls" value={photos.join(",")} />

        {/* Service Completion Date */}
        <div>
          <label className="text-xs font-bold text-[var(--color-ink)] mb-1.5 flex items-center gap-1.5">
            <AnimatedCalendarClock size={16} className="text-[var(--color-link)]" /> Service Completion Date
          </label>
          <input
            type="date"
            name="service_date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="input-base text-xs sm:text-sm max-w-full sm:max-w-xs cursor-pointer rounded-xl font-medium"
            required
          />
        </div>

        {/* Quick Maintenance Preset Chips */}
        <div>
          <label className="text-xs font-bold text-[var(--color-mute)] mb-2 flex items-center gap-1">
            <AnimatedSparkles size={14} className="text-amber-500" /> Quick Maintenance Checklist (Tap to add):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TAGS.map((tag) => {
              const isSelected = notes.includes(tag);
              return (
                <motion.button
                  key={tag}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleAddPresetTag(tag)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-all flex items-center gap-1 font-medium ${
                    isSelected
                      ? "bg-[var(--color-link-soft)] text-[var(--color-link-deep)] border-[var(--color-link)] font-semibold shadow-2xs"
                      : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-body)] border-[var(--color-hairline)] hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {isSelected && <AnimatedCheck size={12} className="text-[var(--color-link)]" />}
                  <span>{tag}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Detailed Service Remarks Textarea */}
        <div>
          <label className="text-xs font-bold text-[var(--color-ink)] mb-1.5 block">
            Detailed Service Remarks & Replaced Parts
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record technician remarks, parts replaced, calibration results, or follow-up recommendations..."
            rows={4}
            className="input-base w-full resize-y text-xs sm:text-sm font-sans leading-relaxed focus:ring-2 focus:ring-[var(--color-link)]/20 rounded-xl"
          />
        </div>

        {/* Photo Documentation Attachments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
              <AnimatedCamera size={16} className="text-[var(--color-link)]" /> Photo Documentation ({photos.length})
            </label>
            <Button
              type="button"
              variant="ghost-sm"
              onClick={() => setShowPhotoModal(true)}
              className="text-xs hover:bg-[var(--color-link-soft)]/40 hover:text-[var(--color-link)] transition-colors py-1 px-2 rounded-lg"
            >
              <AnimatedPlus size={14} className="mr-1" /> Add Image Link
            </Button>
          </div>

          {photos.length > 0 ? (
            <div className="flex flex-wrap gap-2.5 p-3 bg-[var(--color-hairline-soft-surface)]/50 rounded-xl border border-[var(--color-hairline)]">
              {photos.map((p, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border border-[var(--color-hairline)] shadow-2xs">
                  <Image
                    src={p}
                    alt={`Photo preview ${i + 1}`}
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-full opacity-90 sm:opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
                    title="Remove Photo"
                  >
                    <AnimatedTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-mute)] italic">No photo attachments added yet.</p>
          )}
        </div>

        {/* Form Action Submit Button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto shadow-md bg-[var(--color-primary)] hover:opacity-90 active:scale-98 transition-all h-11 px-6 text-xs sm:text-sm font-bold rounded-xl"
          >
            {isPending ? (
              <>
                <AnimatedLoader size={16} className="mr-2 text-white" />
                Updating Service Record...
              </>
            ) : (
              <>
                <AnimatedCheck size={16} className="mr-1.5 text-emerald-400" /> Complete & Update Schedule
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Photo URL Modal */}
      <Modal open={showPhotoModal} onClose={() => setShowPhotoModal(false)} title="Attach Photo Documentation" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[var(--color-mute)]">Enter a direct image URL (e.g. Supabase Storage / Cloudinary link) to attach to this service log.</p>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://images.unsplash.com/... or https://..."
            className="input-base text-xs sm:text-sm w-full rounded-xl"
            autoFocus
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost-sm" onClick={() => setShowPhotoModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addPhoto} disabled={!photoUrl}>
              Attach Photo
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}