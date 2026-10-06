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

export * from "../icons";
export default Icons.Activity;

