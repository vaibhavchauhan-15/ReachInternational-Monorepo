import React from 'react';
import dynamic from 'next/dynamic';
import { aboutContent } from '@/lib/about/content';

// Lazy-load sticky stacking cards GSAP motion below the fold per plan §5
const ServicesStackMotion = dynamic(
  () => import('./ServicesStackMotion').then((mod) => mod.ServicesStackMotion)
);

export function ServicesStack() {
  const { services } = aboutContent;
  if (!services.enabled) return null;

  return (
    <ServicesStackMotion
      heading={services.heading}
      subheading={services.subheading}
      items={services.items}
    />
  );
}
