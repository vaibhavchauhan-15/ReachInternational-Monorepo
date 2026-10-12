"use client";

import { Modal } from "@/components/ui";
import type { User as UserType } from "@/lib/types/database";
import { ProfileEditForm } from "./ProfileEditForm";

export interface EditProfileModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditProfileModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: EditProfileModalProps) {
  const isSuperAdmin = user.role === "super_admin";
  const approverHierarchyLabel =
    user.role === "admin"
      ? "Super Administrator"
      : ["manager", "hr"].includes(user.role)
      ? "Administrator"
      : "Manager / Administrator";

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
      <ProfileEditForm
        user={user}
        isModal={true}
        onSuccess={() => {
          onSuccess?.();
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
