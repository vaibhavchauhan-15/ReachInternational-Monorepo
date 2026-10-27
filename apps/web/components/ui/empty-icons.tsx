"use client";

import React from "react";
import * as Icons from "../icons";

export type LucideIcon = React.ComponentType<any>;
export type LucideProps = React.SVGProps<SVGSVGElement> & {
  size?: string | number;
  color?: string;
  strokeWidth?: string | number;
  className?: string;
};

// Aliases ensuring 100% backward-compatibility for direct "lucide-react" imports
export const Shield = Icons.ShieldCheck;
export const ShieldAlert = Icons.ShieldCheck;
export const ClipboardList = Icons.ClipboardCheck;
export const LogOut = Icons.LogOut;
export const Logout = Icons.LogOut;
export const SignOut = Icons.LogOut;
export const Unlock = Icons.Lock;
export const Briefcase = Icons.BriefcaseBusiness;
export const HelpCircle = Icons.CircleHelp;
export const AlertCircle = Icons.TriangleAlert;
export const AlertTriangle = Icons.TriangleAlert;
export const AlertOctagon = Icons.TriangleAlert;
export const CircleAlert = Icons.TriangleAlert;
export const CircleAlertIcon = Icons.TriangleAlert;
export const CheckCircle = Icons.CircleCheck;
export const CheckCircle2 = Icons.CircleCheck;
export const XCircle = Icons.X;
export const CircleX = Icons.X;
export const CircleXIcon = Icons.X;
export const MoreVertical = Icons.EllipsisVertical;
export const MoreHorizontal = Icons.Ellipsis;
export const Building = Icons.Store;
export const Building2 = Icons.Store;
export const RefreshCw = Icons.RefreshCw;
export const RefreshCW = Icons.RefreshCw;
export const RotateCcw = Icons.RotateCcw;
export const RotateCCW = Icons.RotateCcw;
export const RotateCw = Icons.RotateCw;
export const RotateCW = Icons.RotateCw;
export const Edit = Icons.Pencil;
export const Edit2 = Icons.Pencil;
export const Edit3 = Icons.Pencil;
export const FileEdit = Icons.FilePen;
export const FileCheck2 = Icons.FileCheck;
export const Hash = Icons.Tag;
export const ListFilter = Icons.SlidersHorizontal;
export const ArrowRightLeft = Icons.RotateCw;
export const ZoomIn = Icons.Plus;
export const ZoomOut = Icons.Minus;

export const Maximize2: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);
export const Maximize = Maximize2;
export const Expand = Maximize2;

export const ArrowLeftRight: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8 3 4 7l4 4" />
    <path d="M4 7h16" />
    <path d="m16 21 4-4-4-4" />
    <path d="M20 17H4" />
  </svg>
);

export const WifiOff: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
    <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.82" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

export const Forklift: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 12H5a2 2 0 0 0-2 2v5" />
    <circle cx="13" cy="19" r="2" />
    <circle cx="5" cy="19" r="2" />
    <path d="M8 19h3m5-17v17h6M6 12V7c0-1.1.9-2 2-2h3l5 5" />
  </svg>
);

export const HardHat: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" />
    <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
  </svg>
);

export const Warehouse: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
    <path d="M6 18h12" />
    <path d="M6 14h12" />
    <rect width="12" height="12" x="6" y="10" />
  </svg>
);

export const Factory: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M17 18h1" />
    <path d="M12 18h1" />
    <path d="M7 18h1" />
  </svg>
);

export const Clock5: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 14.5 16" />
  </svg>
);

export const ScanSearch: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3" />
    <path d="m16 16-1.9-1.9" />
  </svg>
);

export const Award: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

export const Headphones: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  </svg>
);

export const CircleDashed: LucideIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0" />
    <path d="M17.6 3.71a10.04 10.04 0 0 1 2.69 2.7" />
    <path d="M21.82 10.1a9.93 9.93 0 0 1 0 3.8" />
    <path d="M20.29 17.6a10.04 10.04 0 0 1-2.7 2.69" />
    <path d="M13.9 21.82a9.94 9.94 0 0 1-3.8 0" />
    <path d="M6.4 20.29a10.04 10.04 0 0 1-2.69-2.7" />
    <path d="M2.18 13.9a9.93 9.93 0 0 1 0-3.8" />
    <path d="M3.71 6.4a10.04 10.04 0 0 1 2.7-2.69" />
  </svg>
);

export * from "../icons";
export default Icons.Activity;


