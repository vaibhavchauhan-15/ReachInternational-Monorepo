"use client";

import type { User } from "@/lib/types/database";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { BottomNav } from "@/components/navigation/BottomNav";

export interface NavbarProps {
  user: User;
}

export function Navbar({ user }: NavbarProps) {
  return (
    <>
      <PublicNavbar user={user} />
      <BottomNav role={user.role} />
      <div className="hidden md:block h-16 w-full flex-shrink-0" />
    </>
  );
}