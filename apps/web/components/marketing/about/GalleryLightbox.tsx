'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLenis } from 'lenis/react';
import { GalleryItem } from '@/lib/about/content';

interface GalleryLightboxProps {
  items: GalleryItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function GalleryLightbox({
  items,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: GalleryLightboxProps) {
  const lenis = useLenis();
  const currentItem = items[currentIndex];

  // Pause Lenis smooth scroll while lightbox modal is active
  useEffect(() => {
    if (isOpen) {
      lenis?.stop();
    } else {
      lenis?.start();
    }

    return () => {
      lenis?.start();
    };
  }, [isOpen, lenis]);

  // Keyboard navigation for ArrowLeft and ArrowRight
  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate((currentIndex - 1 + items.length) % items.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate((currentIndex + 1) % items.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, items.length, onNavigate]);

  if (!currentItem) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Dark Backdrop Overlay with Blur */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content Container with data-lenis-prevent */}
        <Dialog.Content
          data-lenis-prevent="true"
          className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 md:p-8 focus:outline-none"
          aria-describedby="lightbox-description"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between text-white z-10">
            <span className="text-xs sm:text-sm font-mono tracking-wider text-neutral-400">
              {currentIndex + 1} / {items.length}
            </span>
            <Dialog.Close
              className="size-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
              aria-label="Close lightbox"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <VisuallyHidden.Root>
            <Dialog.Title>{currentItem.title}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Main Image Stage */}
          <div className="relative flex-1 flex items-center justify-center my-4">
            {/* Prev Navigation Button */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onNavigate((currentIndex - 1 + items.length) % items.length)}
                className="absolute left-2 sm:left-4 z-20 size-12 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 min-h-[44px] min-w-[44px]"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}

            {/* Active Image */}
            <div className="relative w-full h-full max-h-[75vh] flex items-center justify-center">
              <Image
                key={currentItem.src}
                src={currentItem.src}
                alt={currentItem.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 1200px"
                className="object-contain"
                priority
              />
            </div>

            {/* Next Navigation Button */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onNavigate((currentIndex + 1) % items.length)}
                className="absolute right-2 sm:right-4 z-20 size-12 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 min-h-[44px] min-w-[44px]"
                aria-label="Next image"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>

          {/* Bottom Caption Bar */}
          <div className="text-center z-10 max-w-2xl mx-auto space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              {currentItem.title}
            </h3>
            <p id="lightbox-description" className="text-xs sm:text-sm text-neutral-400">
              {currentItem.alt}
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default GalleryLightbox;
