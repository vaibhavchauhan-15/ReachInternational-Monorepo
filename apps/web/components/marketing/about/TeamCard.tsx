import React from 'react';
import Image from 'next/image';
import { TeamMember } from '@/lib/about/team';

interface TeamCardProps {
  member: TeamMember;
  onSelect?: (member: TeamMember) => void;
}

export function TeamCard({ member, onSelect }: TeamCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(member)}
      className="group rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/60 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 flex flex-col text-left w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
      aria-label={`View bio for ${member.name}, ${member.role}`}
    >
      {/* 4:5 Portrait Container */}
      <div className="relative aspect-[4/5] w-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <Image
          src={member.photo}
          alt={`${member.name}, ${member.role}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
          className="object-cover object-top group-hover:scale-[1.04] transition-transform duration-500 group-hover:will-change-transform"
        />
        {/* Scrim Overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          aria-hidden="true"
        />
        {/* Caption Slide-up */}
        <div
          className="absolute inset-x-0 bottom-0 p-4 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
          aria-hidden="true"
        >
          <span className="inline-flex items-center text-xs font-semibold text-white drop-shadow-sm">
            View Profile &amp; Bio &rarr;
          </span>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-sky-600 dark:text-sky-400">
            {member.group}
          </span>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {member.name}
          </h3>
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-0.5">
            {member.role}
          </p>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-3 leading-relaxed line-clamp-3">
            {member.bio}
          </p>
        </div>

        {member.linkedin && (
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <span className="inline-flex items-center text-xs font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700 dark:group-hover:text-sky-300 min-h-[24px]">
              LinkedIn Profile →
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
