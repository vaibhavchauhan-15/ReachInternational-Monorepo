"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  useToast,
  Input,
} from "@/components/ui";
import { AnimatedUser } from "@/components/ui/animated-icons";
import { updateMyProfile } from "@/app/actions/profile";
import type { User as UserType } from "@/lib/types/database";
import { FormSectionCard } from "@/components/forms";

export interface ProfileEditFormProps {
  user: UserType;
  isModal?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

export function ProfileEditForm({
  user,
  isModal = false,
  onSuccess,
  onCancel,
  showCancelButton = true,
}: ProfileEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(user.full_name || "");
  const [phone, setPhone] = useState(user.phone || "");

  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.full_name || "");
    setPhone(user.phone || "");
    setNameError(null);
    setPhoneError(null);
  }, [user]);

  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError("Full name is required.");
      return false;
    }
    if (trimmed.length < 2) {
      setNameError("Full name must be at least 2 characters.");
      return false;
    }
    setNameError(null);
    return true;
  };

  const validatePhone = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "");
    if (!digitsOnly) {
      setPhoneError("Mobile number is required.");
      return false;
    }
    if (digitsOnly.length < 10) {
      setPhoneError("Enter a valid 10-digit mobile number.");
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const isAllMandatoryFilled = Boolean(
    fullName.trim().length >= 2 &&
    !nameError &&
    phone.replace(/\D/g, "").length >= 10 &&
    !phoneError
  );

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (isModal) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const isNameValid = validateName(fullName);
    const isPhoneValid = validatePhone(phone);

    if (!isNameValid || !isPhoneValid) {
      toast("warning", "Please fix all highlighted errors before submitting.");
      return;
    }

    const formData = new FormData();
    formData.append("full_name", fullName.trim());
    formData.append("phone", phone.trim());

    startTransition(async () => {
      try {
        const res = await updateMyProfile(formData);
        if (res.error) {
          toast("error", res.error);
          return;
        }

        toast(
          "success",
          res.message || "Your personal details have been updated successfully."
        );

        if (onSuccess) {
          onSuccess();
        } else if (!isModal) {
          router.push("/profile");
        }
      } catch (err: any) {
        toast("error", err?.message || "Failed to update profile.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Personal Details Section Card */}
      <FormSectionCard
        stepNumber={1}
        title="Personal Details"
        description="Update your name and primary contact number"
        icon={<AnimatedUser size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />}
        isMandatory={true}
        isCompleted={isAllMandatoryFilled}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                validateName(e.target.value);
              }}
              onBlur={() => validateName(fullName)}
              placeholder="e.g. Rahul Sharma"
              required={true}
              disabled={isPending}
              error={nameError || undefined}
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
                validatePhone(e.target.value);
              }}
              onBlur={() => validatePhone(phone)}
              placeholder="e.g. 9876543210"
              required={true}
              disabled={isPending}
              maxLength={15}
              error={phoneError || undefined}
              className="h-10 font-mono"
            />
          </div>
        </div>
      </FormSectionCard>

      {/* Form Footer Actions in One Row */}
      <div className="flex flex-row items-center justify-end gap-3 pt-3 border-t border-[var(--color-hairline)]">
        {showCancelButton && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={isPending}
            className="flex-1 sm:flex-initial h-10 min-h-[44px] px-5 text-xs sm:text-sm font-semibold rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] cursor-pointer active:scale-[0.98] transition-all"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={!isAllMandatoryFilled || isPending}
          loading={isPending}
          className="flex-1 sm:flex-initial h-10 min-h-[44px] px-6 text-xs sm:text-sm font-bold rounded-lg cursor-pointer active:scale-[0.98] transition-all"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
