"use client";

import type { User } from "@/lib/types/database";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export interface NavbarProps {
  user: User;
}

export function Navbar({ user }: NavbarProps) {
  return (
    <>
      <PublicNavbar user={user} />
      <MobileBottomNav user={user} />
      <div className="hidden md:block h-16 w-full flex-shrink-0" />
    </>
  );
}