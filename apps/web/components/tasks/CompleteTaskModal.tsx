"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, AlertCircle, Paperclip, Camera, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { updateTaskStatus } from "@/app/actions/tasks";
import type { Task } from "@reachinternational/types";

interface CompleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSuccess?: () => void;
}

export function CompleteTaskModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}: CompleteTaskModalProps) {
  const [notes, setNotes] = useState("");
  const [proofUrlInput, setProofUrlInput] = useState("");
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const SAMPLE_PROOFS = [
    { label: "📸 Machine Service Inspection Photo", url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80" },
    { label: "🔧 Field Repair Completion Photo", url: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80" },
  ];

  const addProofUrl = () => {
    if (!proofUrlInput.trim()) return;
    setProofUrls((prev) => [...prev, proofUrlInput.trim()]);
    setProofUrlInput("");
  };

  const addSampleProof = (url: string) => {
    if (!proofUrls.includes(url)) {
      setProofUrls((prev) => [...prev, url]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setProofUrls((prev) => [...prev, dataUrl]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeProofUrl = (index: number) => {
    setProofUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await updateTaskStatus(task.id, "completed", notes, proofUrls);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
      onClose();
    } else {
      setErrorMsg(res.error || "Failed to mark task as completed");
    }
  };

  const isImageFile = (url: string) => {
    return url.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url) || url.includes("images.unsplash");
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Mark Task Complete — #${task.task_no}`}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose} loading={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} loading={loading} variant="primary">
            {loading ? "Submitting..." : "Submit Completion & Proof"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-[var(--color-ink)]">
        {errorMsg && (
          <div className="p-3 text-sm text-rose-600 dark:text-rose-400 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Task Info Summary */}
        <div className="p-3 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl text-xs space-y-1">
          <span className="font-bold text-[var(--color-ink)] block">{task.title}</span>
          {task.description && <p className="text-[var(--color-mute)] truncate">{task.description}</p>}
        </div>

        {/* Completion Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1">
            Completion Notes / Remarks
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe work completed, outcome, or notes for your manager..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-mute)]"
          />
        </div>

        {/* Uploaded Completion Proof Photo */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[var(--color-link)]" /> Upload Proof Photo / Document
          </label>

          {/* Local File Upload Button & URL Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center justify-center gap-2 p-2.5 bg-[var(--color-canvas-elevated)] border border-dashed border-[var(--color-link)]/40 hover:border-[var(--color-link)] rounded-xl text-xs font-semibold text-[var(--color-link)] cursor-pointer transition-colors">
              <Upload className="w-4 h-4" /> Upload Image File
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <div className="flex gap-1.5">
              <Input
                value={proofUrlInput}
                onChange={(e) => setProofUrlInput(e.target.value)}
                placeholder="https://... photo URL"
                className="text-xs"
              />
              <Button type="button" variant="secondary" onClick={addProofUrl} className="text-xs shrink-0">
                Add URL
              </Button>
            </div>
          </div>

          {/* Quick Presets for Demo / Testing */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[10px] font-semibold text-[var(--color-mute)] self-center mr-1">Quick Demo Photos:</span>
            {SAMPLE_PROOFS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => addSampleProof(s.url)}
                className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 transition-colors cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Uploaded Proof Thumbnails List */}
          {proofUrls.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {proofUrls.map((url, idx) => {
                const isImg = isImageFile(url);

                return (
                  <div key={idx} className="relative group p-2 bg-[var(--color-canvas-elevated)] rounded-xl border border-[var(--color-hairline)] flex items-center gap-2.5">
                    {isImg ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-black/5 border border-[var(--color-hairline)]">
                        {/* eslint-disable-next-html-element-suppression */}
                        <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Paperclip className="w-4 h-4 text-purple-500" />
                      </div>
                    )}
                    <div className="truncate min-w-0 flex-1">
                      <span className="text-xs font-semibold text-[var(--color-ink)] block truncate">
                        {url.startsWith("data:image/") ? `Uploaded_Image_${idx + 1}.png` : `Proof_Photo_${idx + 1}`}
                      </span>
                      <span className="text-[10px] text-emerald-500 font-medium">Ready for verification</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProofUrl(idx)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Remove proof"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

