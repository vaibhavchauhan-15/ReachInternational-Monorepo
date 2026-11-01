'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { TeamMember } from '@/lib/about/team';
import { TeamCard } from './TeamCard';
import { Reveal } from '@/components/motion/Reveal';
import { trackEvent } from '@/lib/analytics';

// Lazy-load TeamDrawer island below the fold per plan §5
const TeamDrawer = dynamic(
  () => import('./TeamDrawer').then((mod) => mod.TeamDrawer),
  { ssr: false }
);

interface TeamSectionProps {
  teamMembers: TeamMember[];
}

export function TeamSection({ teamMembers }: TeamSectionProps) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // If no confirmed members without placeholders, gracefully hide per Hard Rule 1
  if (!teamMembers || teamMembers.length === 0) return null;

  const handleSelectMember = (member: TeamMember) => {
    trackEvent('team_drawer_open', {
      member_name: member.name,
      member_role: member.role,
      member_group: member.group,
    });
    setSelectedMember(member);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const leadershipMembers = teamMembers.filter((m) => m.group === 'leadership');
  const allCoreMembers = teamMembers.filter((m) => m.group === 'core' || m.group === 'operations');

  // Limit initial display to 12 per plan §4.8 unless "showAll" is toggled
  const coreMembers = showAll ? allCoreMembers : allCoreMembers.slice(0, 8);
  const hasMore = allCoreMembers.length > 8 && !showAll;

  return (
    <section
      id="core-team"
      aria-labelledby="team-title"
      className="section-content-visibility py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
            People Behind The Fleet
          </span>
          <h2
            id="team-title"
            className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            Leadership &amp; Technical Operations
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            Certified engineers, fleet directors, and field-support specialists committed to safe height operations.
          </p>
        </div>

        {/* Leadership Section with row-wise stagger (3 cols) */}
        {leadershipMembers.length > 0 && (
          <div className="mb-14">
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold mb-6">
              Executive Leadership
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {leadershipMembers.map((member, idx) => (
                <Reveal key={member.id} delay={(idx % 3) * 80}>
                  <TeamCard member={member} onSelect={handleSelectMember} />
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* Core / Operations Team with row-wise stagger (4 cols) */}
        {coreMembers.length > 0 && (
          <div>
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold mb-6">
              Operations &amp; Technical Fleet
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {coreMembers.map((member, idx) => (
                <Reveal key={member.id} delay={(idx % 4) * 80}>
                  <TeamCard member={member} onSelect={handleSelectMember} />
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {hasMore && (
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer"
            >
              Show All Team Members ({teamMembers.length})
            </button>
          </div>
        )}
      </div>

      {/* Lazy-loaded TeamDrawer island */}
      <TeamDrawer
        member={selectedMember}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </section>
  );
}
