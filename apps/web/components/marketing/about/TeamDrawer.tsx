'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X, ExternalLink } from 'lucide-react';
import { TeamMember } from '@/lib/about/team';

interface TeamDrawerProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TeamDrawer({ member, isOpen, onClose }: TeamDrawerProps) {
  // Manage Lenis smooth scrolling pause while modal drawer is open
  useEffect(() => {
    const lenis = typeof window !== 'undefined' ? (window as any).__lenis : null;
    if (isOpen) {
      lenis?.stop();
    } else {
      lenis?.start();
    }

    return () => {
      lenis?.start();
    };
  }, [isOpen]);

  if (!member) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Drawer Content Area (Side drawer on desktop, bottom sheet on mobile) */}
        <Dialog.Content
          className="fixed z-50 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-2xl focus:outline-none 
          /* Mobile: Bottom Sheet */
          inset-x-0 bottom-0 max-h-[90svh] rounded-t-3xl border-t p-6 
          /* Desktop: Right Slide-in Side Drawer */
          md:inset-y-0 md:right-0 md:left-auto md:w-full md:max-w-md md:rounded-l-3xl md:rounded-t-none md:border-l md:border-t-0 md:p-8
          data-[state=open]:animate-in data-[state=closed]:animate-out 
          md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right
          data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          aria-describedby="team-member-bio"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-xs font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
              {member.group} Details
            </span>
            <Dialog.Close
              className="size-9 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <VisuallyHidden.Root>
            <Dialog.Title>{member.name} — {member.role}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Scrollable Body with data-lenis-prevent */}
          <div
            data-lenis-prevent="true"
            className="overflow-y-auto max-h-[calc(85svh-80px)] md:max-h-[calc(100svh-120px)] pt-6 pb-8 space-y-6"
          >
            {/* Member Photo */}
            <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100 dark:bg-neutral-800 shadow-sm">
              <Image
                src={member.photo}
                alt={`${member.name}, ${member.role}`}
                fill
                sizes="(max-width: 768px) 100vw, 420px"
                className="object-cover object-top"
              />
            </div>

            {/* Member Titles */}
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                {member.name}
              </h2>
              <p className="text-base font-semibold text-sky-600 dark:text-sky-400 mt-0.5">
                {member.role}
              </p>
            </div>

            {/* Member Bio */}
            <div id="team-member-bio" className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-3">
              <p>{member.bio}</p>
            </div>

            {/* Professional Profiles */}
            {member.linkedin && (
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/60 dark:border-sky-800/60 transition-colors min-h-[44px]"
                >
                  <span>Connect on LinkedIn</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default TeamDrawer;
