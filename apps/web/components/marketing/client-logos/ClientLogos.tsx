'use client';

import React from 'react';
import type { LogoItem } from '@/components/marketing/ui/logo-loop';

// ── Shared Card Container for Official Client Logos (Dual-Theme Adaptive) ──
function OfficialLogoCard({
  src,
  darkSrc,
  alt,
  widthClass = 'max-w-[130px]',
}: {
  src: string;
  darkSrc?: string;
  alt: string;
  widthClass?: string;
}) {
  const darkImageSrc = darkSrc || src;
  const isDual = darkImageSrc !== src;

  return (
    <div
      className="group/card relative h-16 min-w-[150px] max-w-[210px] px-5 py-2.5 rounded-2xl flex items-center justify-center transition-all duration-300 border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-2xs hover:border-[var(--brand-blue)]/60 dark:hover:border-[var(--brand-blue)]/60 hover:shadow-md hover:scale-105 select-none"
      aria-label={alt}
    >
      {/* Light Theme Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`max-h-10 ${widthClass} w-auto h-auto object-contain select-none pointer-events-none transition-opacity duration-200 ${
          isDual ? 'dark:hidden' : ''
        }`}
        loading="lazy"
        draggable={false}
      />

      {/* Dark Theme Logo (rendered when theme is dark) */}
      {isDual && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={darkImageSrc}
          alt={alt}
          className={`max-h-10 ${widthClass} w-auto h-auto object-contain select-none pointer-events-none transition-opacity duration-200 hidden dark:block`}
          loading="lazy"
          draggable={false}
        />
      )}
    </div>
  );
}

// ── Row 1 Client List (Left-to-Right Loop) ──────────────────────────────────
export const clientsRow1: LogoItem[] = [
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/reliance.png"
        darkSrc="/images/clients/reliance_dark.png"
        alt="Reliance Industries Limited"
        widthClass="max-w-[140px]"
      />
    ),
    title: 'Reliance Industries Limited',
    ariaLabel: 'Reliance Industries Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/hero.svg"
        darkSrc="/images/clients/hero_dark.svg"
        alt="Hero MotoCorp Limited"
        widthClass="max-w-[125px]"
      />
    ),
    title: 'Hero MotoCorp Limited',
    ariaLabel: 'Hero MotoCorp Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/saint_gobain.png"
        darkSrc="/images/clients/saint_gobain_dark.png"
        alt="Saint-Gobain India"
        widthClass="max-w-[135px]"
      />
    ),
    title: 'Saint-Gobain India',
    ariaLabel: 'Saint-Gobain India',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/honda.svg"
        alt="Honda Cars & Motorcycles India"
        widthClass="max-w-[110px]"
      />
    ),
    title: 'Honda Cars & Motorcycles India',
    ariaLabel: 'Honda Cars & Motorcycles India',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/pg.svg"
        alt="Procter & Gamble (P&G)"
        widthClass="max-w-[100px]"
      />
    ),
    title: 'Procter & Gamble (P&G)',
    ariaLabel: 'Procter & Gamble (P&G)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/indianoil.svg"
        alt="Indian Oil Corporation Limited (IOCL)"
        widthClass="max-w-[120px]"
      />
    ),
    title: 'Indian Oil Corporation Limited (IOCL)',
    ariaLabel: 'Indian Oil Corporation Limited (IOCL)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/hul.png"
        darkSrc="/images/clients/hul_dark.png"
        alt="Hindustan Unilever Limited (HUL)"
        widthClass="max-w-[130px]"
      />
    ),
    title: 'Hindustan Unilever Limited (HUL)',
    ariaLabel: 'Hindustan Unilever Limited (HUL)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/nestle.svg"
        darkSrc="/images/clients/nestle_dark.svg"
        alt="Nestlé India Limited"
        widthClass="max-w-[115px]"
      />
    ),
    title: 'Nestlé India Limited',
    ariaLabel: 'Nestlé India Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/abb.svg"
        alt="ABB India Limited"
        widthClass="max-w-[100px]"
      />
    ),
    title: 'ABB India Limited',
    ariaLabel: 'ABB India Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/mrf.svg"
        alt="MRF Tyres Limited"
        widthClass="max-w-[120px]"
      />
    ),
    title: 'MRF Tyres Limited',
    ariaLabel: 'MRF Tyres Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/samsung.svg"
        alt="Samsung India Electronics"
        widthClass="max-w-[130px]"
      />
    ),
    title: 'Samsung India Electronics',
    ariaLabel: 'Samsung India Electronics',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/shapoorji_pallonji.png"
        darkSrc="/images/clients/shapoorji_pallonji_dark.png"
        alt="Shapoorji Pallonji Group"
        widthClass="max-w-[140px]"
      />
    ),
    title: 'Shapoorji Pallonji Group',
    ariaLabel: 'Shapoorji Pallonji Group',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/isrl.png"
        darkSrc="/images/clients/isrl_dark.png"
        alt="Indian Synthetic Rubber Private Limited (ISRL)"
        widthClass="max-w-[125px]"
      />
    ),
    title: 'Indian Synthetic Rubber Private Limited (ISRL)',
    ariaLabel: 'Indian Synthetic Rubber Private Limited (ISRL)',
  },
];

// ── Row 2 Client List (Right-to-Left Loop) ──────────────────────────────────
export const clientsRow2: LogoItem[] = [
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/maruti.svg"
        darkSrc="/images/clients/maruti_dark.svg"
        alt="Maruti Suzuki India Limited"
        widthClass="max-w-[120px]"
      />
    ),
    title: 'Maruti Suzuki India Limited',
    ariaLabel: 'Maruti Suzuki India Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/delhi_metro.svg"
        alt="Delhi Metro Rail Corporation Limited (DMRC)"
        widthClass="max-w-[130px]"
      />
    ),
    title: 'Delhi Metro Rail Corporation Limited (DMRC)',
    ariaLabel: 'Delhi Metro Rail Corporation Limited (DMRC)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/blue_star.png"
        darkSrc="/images/clients/blue_star_dark.png"
        alt="Blue Star Limited"
        widthClass="max-w-[130px]"
      />
    ),
    title: 'Blue Star Limited',
    ariaLabel: 'Blue Star Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/hindalco.png"
        darkSrc="/images/clients/hindalco_dark.png"
        alt="Hindalco Industries Limited (Aditya Birla Group)"
        widthClass="max-w-[135px]"
      />
    ),
    title: 'Hindalco Industries Limited (Aditya Birla Group)',
    ariaLabel: 'Hindalco Industries Limited (Aditya Birla Group)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/johnson_controls.png"
        darkSrc="/images/clients/johnson_controls_dark.png"
        alt="Johnson Controls (India) Private Limited"
        widthClass="max-w-[140px]"
      />
    ),
    title: 'Johnson Controls (India) Private Limited',
    ariaLabel: 'Johnson Controls (India) Private Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/mitsubishi_electric.svg"
        darkSrc="/images/clients/mitsubishi_electric_dark.svg"
        alt="Mitsubishi Electric India"
        widthClass="max-w-[140px]"
      />
    ),
    title: 'Mitsubishi Electric India',
    ariaLabel: 'Mitsubishi Electric India',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/ncc.png"
        darkSrc="/images/clients/ncc_dark.png"
        alt="NCC Limited (Nagarjuna Construction)"
        widthClass="max-w-[110px]"
      />
    ),
    title: 'NCC Limited (Nagarjuna Construction)',
    ariaLabel: 'NCC Limited (Nagarjuna Construction)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/power_mech.png"
        darkSrc="/images/clients/power_mech_dark.png"
        alt="Power Mech Projects Limited"
        widthClass="max-w-[135px]"
      />
    ),
    title: 'Power Mech Projects Limited',
    ariaLabel: 'Power Mech Projects Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/tecnimont.svg"
        darkSrc="/images/clients/tecnimont_dark.svg"
        alt="Tecnimont Private Limited (MAIRE Group)"
        widthClass="max-w-[135px]"
      />
    ),
    title: 'Tecnimont Private Limited (MAIRE Group)',
    ariaLabel: 'Tecnimont Private Limited (MAIRE Group)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/meil.png"
        darkSrc="/images/clients/meil_dark.png"
        alt="Megha Engineering & Infrastructure Limited (MEIL)"
        widthClass="max-w-[125px]"
      />
    ),
    title: 'Megha Engineering & Infrastructure Limited (MEIL)',
    ariaLabel: 'Megha Engineering & Infrastructure Limited (MEIL)',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/batliboi.png"
        darkSrc="/images/clients/batliboi_dark.png"
        alt="Batliboi Limited"
        widthClass="max-w-[125px]"
      />
    ),
    title: 'Batliboi Limited',
    ariaLabel: 'Batliboi Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/cg_power.svg"
        darkSrc="/images/clients/cg_power_dark.svg"
        alt="CG Power and Industrial Solutions Limited"
        widthClass="max-w-[135px]"
      />
    ),
    title: 'CG Power and Industrial Solutions Limited',
    ariaLabel: 'CG Power and Industrial Solutions Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/jk_paper.png"
        darkSrc="/images/clients/jk_paper_dark.png"
        alt="J.K. Paper Limited"
        widthClass="max-w-[120px]"
      />
    ),
    title: 'J.K. Paper Limited',
    ariaLabel: 'J.K. Paper Limited',
  },
  {
    node: (
      <OfficialLogoCard
        src="/images/clients/fleur_de_lis.png"
        darkSrc="/images/clients/fleur_de_lis_dark.png"
        alt="Heritage Enterprise Client Partner"
        widthClass="max-w-[100px]"
      />
    ),
    title: 'Heritage Enterprise Client Partner',
    ariaLabel: 'Heritage Enterprise Client Partner',
  },
];
