"use client";

import { PublicNavbar, type PublicNavbarProps } from "@/components/layout/PublicNavbar";

export type LandingHeaderProps = PublicNavbarProps;

export function LandingHeader(props: LandingHeaderProps) {
  return <PublicNavbar {...props} />;
}
