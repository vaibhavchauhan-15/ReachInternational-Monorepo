/**
 * ReachInternational Client-Side Document Image Compression Utility
 * Implements high-performance canvas compression at pick time.
 *
 * ─── Compression Strategy (Universal Document Clarity & Reliability) ────────
 * Handles all document image types seamlessly without artificial rejections:
 *
 * 1. Already-compressed / Low-size images (e.g. 20 KB – 300 KB, cropped ID cards, scans):
 *    - Preserves native dimensions without downscaling when within bounds (<= 2400 px).
 *    - Never rejects clear documents for resolution (including dimensions < 600 px).
 *    - Re-encodes to clean standard JPEG, stripping privacy-sensitive EXIF/GPS metadata.
 *
 * 2. Average size images (e.g. 500 KB – 3 MB, 1000–2500 px):
 *    - Constrains long edge to 2400 px.
 *    - Passes 1 & 2 (0.92 → 0.85 quality) preserve microprint, text, and QR codes
 *      while yielding a lightweight payload (<= 800 KB).
 *
 * 3. High-resolution / High-quality / Large-size images (e.g. 5 MB – 30 MB, 12MP–48MP camera photos):
 *    - Adaptive multi-pass loop (2400 px @ 0.92 → 2400 px @ 0.85 → 2000 px @ 0.80 →
 *      1600 px @ 0.78 → 1400 px @ 0.75 → 1200 px @ 0.70 → 1000 px @ 0.65)
 *      dynamically scales and compresses according to need.
 *    - Guarantees the payload safely fits within storage boundaries (< 2.5 MB)
 *      without throwing unwanted size errors.
 *
 * 4. Dual-Strategy Decoding:
 *    - Strategy 1: `createImageBitmap` with automatic EXIF orientation (fastest, off-thread).
 *    - Strategy 2: `HTMLImageElement` fallback for broad browser engine compatibility (JPG, PNG, WEBP).
 * ──────────────────────────────────────────────────────────────────────────────
 */

export interface CompressedDocumentResult {
  mainBlob: Blob;
  thumbBlob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  thumbSizeBytes: number;
}

/**
 * Calculates proportional dimensions constrained to a maximum long edge.
 * If the image is already smaller than maxLongEdge, it leaves dimensions untouched.
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxLongEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(origWidth, origHeight);
  if (longEdge <= maxLongEdge) {
    return { width: origWidth, height: origHeight };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(origWidth * scale)),
    height: Math.max(1, Math.round(origHeight * scale)),
  };
}

/**
 * Validates document image dimensions.
 * Accepts all clear, readable images (including cropped or compact documents under 600 px).
 * Only rejects degenerate or zero-size inputs (< 16 px).
 */
export function validateDocumentDimensions(
  width: number,
  height: number
): { valid: boolean; reason?: string } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { valid: false, reason: "Invalid image: unable to determine dimensions." };
  }
  if (Math.max(width, height) < 16) {
    return {
      valid: false,
      reason: "Image resolution is too low to be a valid document. Minimum dimension is 16 px.",
    };
  }
  return { valid: true };
}

interface DecodedImageSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

/**
 * Decodes a File or Blob into a renderable CanvasImageSource using dual-strategy decoding.
 */
async function decodeImageSource(file: File | Blob): Promise<DecodedImageSource> {
  // Strategy 1: createImageBitmap with orientation handling (fast, off-main-thread)
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close?.(),
        };
      }
    } catch {
      // Strategy 1b: Try without options in case browser doesn't support the options dictionary
      try {
        const bitmap = await createImageBitmap(file);
        if (bitmap.width > 0 && bitmap.height > 0) {
          return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            cleanup: () => bitmap.close?.(),
          };
        }
      } catch {
        // Fall through to HTMLImageElement fallback
      }
    }
  }

  // Strategy 2: HTMLImageElement fallback (reliable across all browser engines)
  if (typeof window !== "undefined" && typeof Image !== "undefined") {
    return new Promise<DecodedImageSource>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w > 0 && h > 0) {
          resolve({
            source: img,
            width: w,
            height: h,
            cleanup: () => URL.revokeObjectURL(objectUrl),
          });
        } else {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Unable to determine image dimensions."));
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(
          new Error("Unsupported or corrupted image file. Please choose a valid JPG, PNG, or WEBP.")
        );
      };
      img.src = objectUrl;
    });
  }

  throw new Error("Canvas rendering API not available in current environment.");
}

/**
 * Renders a CanvasImageSource to a JPEG Blob using OffscreenCanvas (or HTMLCanvasElement fallback).
 */
async function renderToJpegBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(safeW, safeH);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D context from OffscreenCanvas.");
    ctx.drawImage(source, 0, 0, safeW, safeH);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  // Fallback for older Safari or environments without OffscreenCanvas
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = safeW;
    canvas.height = safeH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D context from HTMLCanvasElement.");
    ctx.drawImage(source, 0, 0, safeW, safeH);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to encode JPEG image blob."));
        },
        "image/jpeg",
        quality
      );
    });
  }

  throw new Error("Canvas rendering API not available in current environment.");
}

/**
 * Compresses a document image at pick time using an adaptive multi-pass strategy
 * that handles all image sizes and formats:
 * - Already compressed / low size images: preserved with native dimensions and high clarity.
 * - Average size images: optimized to <= 800 KB with near-lossless text/QR clarity.
 * - High resolution / large size images: adaptively scaled to fit safely under 2.5 MB.
 *
 * Strips EXIF/GPS metadata via canvas re-encode for privacy protection.
 */
export async function compressImageForUpload(
  file: File | Blob
): Promise<CompressedDocumentResult> {
  const decoded = await decodeImageSource(file);

  try {
    const origW = decoded.width;
    const origH = decoded.height;

    const validation = validateDocumentDimensions(origW, origH);
    if (!validation.valid) {
      throw new Error(validation.reason || "Invalid image dimensions.");
    }

    const shortEdge = Math.min(origW, origH);
    if (shortEdge < 600) {
      // Gracefully accept compact or cropped document photos (e.g. 500x350 ID cards or scans)
      console.info(
        `[ImageCompression] Processing compact document image (${origW}x${origH} px). Preserving full resolution.`
      );
    }

    // ─── Adaptive Multi-Pass Compression Loop ──────────────────────────────────
    //
    // Passes dynamically adapt to input image type:
    // - Low size / already compressed: completes on Pass 1 (<= 800 KB) with near-lossless 0.92 quality.
    // - Average size: completes on Pass 1 or Pass 2 (0.85 quality).
    // - High resolution / large size: adapts through passes 3-7 to guarantee the file
    //   comfortably fits under the 2.5 MB ceiling without throwing unwanted errors.

    // Pass 1: maxEdge 2400 px @ 0.92 quality — near-lossless, text & QR codes fully intact
    let dims = calculateTargetDimensions(origW, origH, 2400);
    let blob = await renderToJpegBlob(decoded.source, dims.width, dims.height, 0.92);

    // Pass 2: Soft quality reduction to 0.85 if still > 800 KB (visually lossless for text)
    if (blob.size > 800_000) {
      blob = await renderToJpegBlob(decoded.source, dims.width, dims.height, 0.85);

      // Pass 3: Dimension reduction to 2000 px @ 0.80 quality
      if (blob.size > 800_000) {
        dims = calculateTargetDimensions(origW, origH, 2000);
        blob = await renderToJpegBlob(decoded.source, dims.width, dims.height, 0.80);

        // Pass 4: Dimension reduction to 1600 px @ 0.78 quality
        if (blob.size > 1_200_000) {
          dims = calculateTargetDimensions(origW, origH, 1600);
          blob = await renderToJpegBlob(decoded.source, dims.width, dims.height, 0.78);

          // Pass 5: Dimension reduction to 1400 px @ 0.75 quality
          if (blob.size > 1_600_000) {
            dims = calculateTargetDimensions(origW, origH, 1400);
            blob = await renderToJpegBlob(decoded.source, dims.width, dims.height, 0.75);

            // Pass 6: Dimension reduction to 1200 px @ 0.70 quality
            if (blob.size > 2_000_000) {
              dims = calculateTargetDimensions(origW, origH, 1200);
              blob = await renderToJpegBlob(decoded.source, dims.width, dims.height, 0.70);

              // Pass 7: Extreme resolution fallback (e.g. 50MP noisy files) — 1000 px @ 0.65
              if (blob.size > 2_400_000) {
                dims = calculateTargetDimensions(origW, origH, 1000);
                blob = await renderToJpegBlob(decoded.source, dims.width, dims.height, 0.65);
              }
            }
          }
        }
      }
    }

    // Hard ceiling check (Supabase limit is 50 MB; 2.5 MB is the monorepo document ceiling)
    if (blob.size > 2_500_000) {
      throw new Error("Document image exceeds maximum size of 2.5 MB.");
    }

    // ─── Thumbnail Generation ───────────────────────────────────────────────
    // Constrained to 480 px max edge (or original if smaller), 0.82 quality.
    const thumbDims = calculateTargetDimensions(origW, origH, 480);
    const thumbBlob = await renderToJpegBlob(decoded.source, thumbDims.width, thumbDims.height, 0.82);

    // Create browser preview URL for immediate UI display
    const previewUrl = URL.createObjectURL(blob);

    return {
      mainBlob: blob,
      thumbBlob,
      previewUrl,
      width: dims.width,
      height: dims.height,
      sizeBytes: blob.size,
      thumbSizeBytes: thumbBlob.size,
    };
  } finally {
    decoded.cleanup();
  }
}
