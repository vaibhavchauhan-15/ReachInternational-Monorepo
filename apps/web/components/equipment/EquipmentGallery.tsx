"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { EquipmentMedia } from "@reachinternational/types";
import { cn } from "@/lib/utils";

export interface EquipmentGalleryProps {
  media: EquipmentMedia[];
  modelName: string;
  className?: string;
}

export function EquipmentGallery({ media, modelName, className }: EquipmentGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const currentMedia = media[selectedIndex] || {
    media_url: "/images/awp_boom_lift.jpg",
    alt_text: modelName,
  };

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % media.length);
  }, [media.length]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => (prev - 1 + media.length) % media.length);
  }, [media.length]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, handleNext, handlePrev]);

  return (
    <div className={cn("flex flex-col gap-3 sm:gap-4", className)}>
      {/* Primary Main Viewport */}
      <div className="relative aspect-[4/3] sm:aspect-[16/11] w-full rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800/90 shadow-sm group">
        <Image
          src={currentMedia.media_url}
          alt={currentMedia.alt_text || `${modelName} machinery view`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-contain p-2 sm:p-4 transition-transform duration-500 ease-out"
        />

        {/* Fullscreen Zoom Trigger Button */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute bottom-3 right-3 p-2.5 rounded-xl bg-white/90 dark:bg-black/80 hover:bg-white dark:hover:bg-black text-neutral-800 dark:text-neutral-200 shadow-md backdrop-blur-xs transition-transform active:scale-95 cursor-pointer"
          aria-label="View full screen image gallery"
        >
          <Maximize2 className="size-4" />
        </button>

        {/* Carousel Arrow Controls (when more than 1 image) */}
        {media.length > 1 && (
          <div className="absolute inset-y-0 left-2 right-2 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handlePrev}
              className="pointer-events-auto p-2 rounded-full bg-white/90 dark:bg-black/80 text-neutral-800 dark:text-white shadow-md hover:scale-105 transition-transform cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="pointer-events-auto p-2 rounded-full bg-white/90 dark:bg-black/80 text-neutral-800 dark:text-white shadow-md hover:scale-105 transition-transform cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      {media.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {media.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id || idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  "relative aspect-[16/11] w-20 sm:w-24 shrink-0 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 border transition-all cursor-pointer",
                  isSelected
                    ? "border-[#0284c7] ring-2 ring-[#0284c7]/20 shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 opacity-60 hover:opacity-100"
                )}
                aria-label={`Thumbnail ${idx + 1} of ${media.length}`}
              >
                <Image
                  src={item.media_url}
                  alt={item.alt_text || `Thumbnail ${idx + 1}`}
                  fill
                  sizes="100px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal (Dialog) */}
      <Dialog.Root open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 animate-in fade-in-0 duration-200" />
          <Dialog.Content className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 focus:outline-hidden">
            <VisuallyHidden.Root>
              <Dialog.Title>{modelName} Fullscreen Gallery</Dialog.Title>
              <Dialog.Description>High resolution machine images and technical views</Dialog.Description>
            </VisuallyHidden.Root>

            {/* Top Bar */}
            <div className="flex items-center justify-between text-white z-10">
              <div>
                <h4 className="text-base sm:text-lg font-bold">{modelName}</h4>
                <p className="text-xs text-neutral-400 font-mono">
                  Image {selectedIndex + 1} of {media.length}
                </p>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  aria-label="Close fullscreen gallery"
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Stage */}
            <div className="relative flex-1 w-full my-4 flex items-center justify-center">
              <div className="relative w-full h-full max-w-5xl max-h-[80vh]">
                <Image
                  src={currentMedia.media_url}
                  alt={currentMedia.alt_text || modelName}
                  fill
                  priority
                  sizes="100vw"
                  className="object-contain"
                />
              </div>

              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-2 sm:left-6 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 transition-transform hover:scale-105 cursor-pointer"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-2 sm:right-6 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 transition-transform hover:scale-105 cursor-pointer"
                    aria-label="Next image"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom Indicator Dots */}
            {media.length > 1 && (
              <div className="flex items-center justify-center gap-2 py-2">
                {media.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={cn(
                      "size-2 rounded-full transition-all cursor-pointer",
                      i === selectedIndex ? "w-6 bg-[#0284c7]" : "bg-white/40 hover:bg-white/70"
                    )}
                    aria-label={`Jump to slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
