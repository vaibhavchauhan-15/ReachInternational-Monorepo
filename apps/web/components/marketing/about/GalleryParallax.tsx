'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { aboutContent } from '@/lib/about/content';
import { Parallax } from '@/components/motion/Parallax';
import { Reveal } from '@/components/motion/Reveal';

// Lazy-load GalleryLightbox island below the fold per plan §5
const GalleryLightbox = dynamic(
  () => import('./GalleryLightbox').then((mod) => mod.GalleryLightbox),
  { ssr: false }
);

// Different parallax speeds per image for desktop masonry float per plan §5
const PARALLAX_SPEEDS = [6, 12, 4, 10, 14, 7];

export function GalleryParallax() {
  const { gallery } = aboutContent;
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (!gallery.enabled || gallery.items.length === 0) return null;

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  return (
    <section
      id="reach-in-action"
      aria-labelledby="gallery-title"
      className="section-content-visibility py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
            Worksite Proof
          </span>
          <h2
            id="gallery-title"
            className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            {gallery.heading}
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            {gallery.subheading}
          </p>
        </div>

        {/* Asymmetric CSS Grid Masonry with Per-Image Parallax Speeds */}
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {gallery.items.map((item, idx) => {
              // Asymmetric spans for masonry feel on desktop
              const spanClass =
                idx === 0
                  ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2 aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto'
                  : idx === 3
                  ? 'sm:col-span-2 lg:col-span-1 aspect-[4/3]'
                  : 'aspect-[4/3]';

              const speed = PARALLAX_SPEEDS[idx % PARALLAX_SPEEDS.length];

              return (
                <Parallax
                  key={item.id}
                  range={speed}
                  className={`rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100 dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${spanClass}`}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenLightbox(idx)}
                    className="group relative w-full h-full block text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500 overflow-hidden"
                    aria-label={`Enlarge photo: ${item.title}`}
                  >
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes={
                        idx === 0
                          ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px'
                          : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px'
                      }
                      className="object-cover group-hover:scale-105 transition-transform duration-500 group-hover:will-change-transform"
                    />
                    {/* Subtle Gradient & Title Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-5 flex items-end">
                      <p className="text-sm font-semibold text-white drop-shadow-sm">
                        {item.title}
                      </p>
                    </div>
                  </button>
                </Parallax>
              );
            })}
          </div>
        </Reveal>
      </div>

      {/* Accessible Lazy-Loaded Lightbox */}
      <GalleryLightbox
        items={gallery.items}
        currentIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
      />
    </section>
  );
}
