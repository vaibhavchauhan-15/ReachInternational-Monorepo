"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui";
import { EditProfileModal } from "./EditProfileModal";
import type { User } from "@/lib/types/database";

interface ProfileEditButtonProps {
  user: User;
  initialOpen?: boolean;
}

export function ProfileEditButton({ user, initialOpen = false }: ProfileEditButtonProps) {
  const [open, setOpen] = useState(initialOpen);
  const router = useRouter();

  return (
    <>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Edit size={14} className="text-sky-500" />}
          onClick={() => router.push("/profile/edit")}
          className="w-full sm:w-auto font-semibold cursor-pointer"
        >
          Edit Profile
        </Button>
      </div>

      {open && (
        <EditProfileModal
          user={user}
          isOpen={open}
          onClose={() => {
            setOpen(false);
            // If opened via ?edit=true, clean up the query param
            if (window.location.search.includes("edit=")) {
              router.replace("/profile");
            }
          }}
          onSuccess={() => {
            setOpen(false);
            router.replace("/profile");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
