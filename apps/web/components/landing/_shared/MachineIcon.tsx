import { SVGProps } from "react";

/**
 * Ink line-art machine icons. All draw with `currentColor` (fill:none) so they inherit
 * text color and adapt to light/dark automatically. Single source for the equipment gallery.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function base(props: IconProps) {
  const { size = 40, width, height, className, ...rest } = props;
  const w = width ?? size;
  const h = height ?? size;
  return {
    viewBox: "0 0 48 48",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: w,
    height: h,
    className: className || "shrink-0",
    ...rest,
  };
}

const wheels = (
  <>
    <circle cx="16" cy="38" r="4" />
    <circle cx="34" cy="38" r="4" />
  </>
);

export function ExcavatorIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 40h14a5 5 0 0 0 5-5v-6h10a4 4 0 0 1 4 4v7" />
      <path d="M25 29 34 16" />
      <path d="M34 16l7 3-4 6" />
      <path d="M8 40v-6h12" />
      <circle cx="12" cy="34" r="1" />
    </svg>
  );
}

export function BulldozerIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 24h18l4 8H12z" />
      <path d="M32 26h6v8" />
      <path d="M8 34h30" />
      <path d="M6 30v6" />
      {wheels}
    </svg>
  );
}

export function LoaderIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 26l8-2 4 8H16a6 6 0 0 0 6 6h12a4 4 0 0 0 4-4v-9h-8" />
      <path d="M4 26l-1 8h5" />
      <path d="M30 25V17h8v8" />
      {wheels}
    </svg>
  );
}

export function CraneIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M24 42V14" />
      <path d="M10 14h30" />
      <path d="M24 14 14 8" />
      <path d="M38 14v6" />
      <path d="M18 42h12" />
      <path d="M14 8v4" />
    </svg>
  );
}

export function ForkliftIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 34V20h10l6 8v6" />
      <path d="M32 12v22" />
      <path d="M32 34h6" />
      <path d="M32 18h-6" />
      {wheels}
    </svg>
  );
}

export function DumpTruckIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 22l14-4 4 12H6z" />
      <path d="M22 30V18h8l6 6v6" />
      <path d="M4 30h32" />
      {wheels}
    </svg>
  );
}
