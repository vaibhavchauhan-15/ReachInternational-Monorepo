"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui";
import type { User } from "@/lib/types/database";

const EditProfileModal = dynamic(
  () =>
    import("@/components/profile/EditProfileModal").then(
      (mod) => mod.EditProfileModal
    ),
  { ssr: false }
);

interface ProfileEditButtonProps {
  user: User;
}

export function ProfileEditButton({ user }: ProfileEditButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Edit size={14} className="text-sky-500" />}
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto font-semibold cursor-pointer"
      >
        Edit Profile
      </Button>

      {open && (
        <EditProfileModal
          user={user}
          isOpen={open}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
