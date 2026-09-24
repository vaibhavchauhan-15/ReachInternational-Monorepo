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
export const LogOut = Icons.ArrowRight;
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

export * from "../icons";
export default Icons.Activity;

