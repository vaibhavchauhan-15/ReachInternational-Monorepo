"use client";

import React, { forwardRef, useState } from "react";
import { Input } from "./Input";
import { AnimatedEye, AnimatedEyeOff, AnimatedLock } from "./animated-icons";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  showLockIcon?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ icon, showLockIcon = false, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="password"
        icon={icon || (showLockIcon ? <AnimatedLock size={15} /> : undefined)}
        {...props}
      />
    );
  }
);

PasswordInput.displayName = "PasswordInput";
