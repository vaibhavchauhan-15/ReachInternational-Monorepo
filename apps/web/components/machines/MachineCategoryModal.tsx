"use client";

import { useState, useTransition } from "react";
import { Modal, Input, Textarea, Button, useToast } from "@/components/ui";
import { createCategory, deleteCategory } from "@/app/actions/categories";
import type { MachineCategory } from "@/lib/types/database";
import { AnimatedPlus, AnimatedTrash, AnimatedTag } from "@/components/ui/animated-icons";

interface MachineCategoryModalProps {
  open: boolean;
  onClose: () => void;
  categories: MachineCategory[];
  onCategoryAdded?: () => void;
}

export function MachineCategoryModal({
  open,
  onClose,
  categories,
  onCategoryAdded,
}: MachineCategoryModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const formData = new FormData();
    formData.append("name", name.trim());
    if (description.trim()) formData.append("description", description.trim());

    startTransition(async () => {
      const res = await createCategory(null, formData);
      if (res.error) {
        toast("error", "Failed to create category", res.error);
      } else {
        toast("success", `Category "${name}" created successfully`);
        setName("");
        setDescription("");
        if (onCategoryAdded) onCategoryAdded();
      }
    });
  };

  const handleDeleteCategory = (catId: string, catName: string) => {
    startTransition(async () => {
      const res = await deleteCategory(catId);
      if (res.error) {
        toast("error", "Failed to delete category", res.error);
      } else {
        toast("success", `Category "${catName}" deleted`);
        if (onCategoryAdded) onCategoryAdded();
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Machine Categories" size="lg">
      <div className="flex flex-col gap-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Create New Category Form */}
        <form onSubmit={handleAddCategory} className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedTag size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Add New Machine Category
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Category Name"
              placeholder="e.g. Scissor Lift"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
            <Textarea
              label="Description (Optional)"
              placeholder="Short description of equipment type..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary-sm" loading={isPending}>
              <AnimatedPlus size={14} className="mr-1" /> Add Category
            </Button>
          </div>
        </form>

        {/* Categories List */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)]">
            Existing Machine Categories ({categories.length})
          </h4>

          {categories.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--color-mute)] border rounded-xl border-dashed">
              No machine categories created yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-[var(--color-ink)] transition-colors"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-bold text-[var(--color-ink)] truncate">
                      {cat.name}
                    </span>
                    {cat.description && (
                      <span className="text-[11px] text-[var(--color-mute)] line-clamp-1">
                        {cat.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    disabled={isPending}
                    className="p-1 text-[var(--color-mute)] hover:text-red-600 rounded transition-colors"
                    title="Delete Category"
                  >
                    <AnimatedTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
