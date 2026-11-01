import React from 'react';
import dynamic from 'next/dynamic';
import { aboutContent, isPlaceholder } from '@/lib/about/content';

// Lazy-load pinned horizontal GSAP timeline below the fold per plan §5
const JourneyTimelineMotion = dynamic(
  () => import('./JourneyTimelineMotion').then((mod) => mod.JourneyTimelineMotion)
);

export function JourneyTimeline() {
  const { journey } = aboutContent;
  if (!journey.enabled) return null;

  const validMilestones = journey.milestones.filter(
    (m) => !isPlaceholder(m.year) && !isPlaceholder(m.title)
  );

  if (validMilestones.length === 0) return null;

  return (
    <JourneyTimelineMotion
      milestones={validMilestones}
      heading={journey.heading}
      subheading={journey.subheading}
    />
  );
}
