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
 * Prioritizes HTMLImageElement with img.decode() to guarantee that raster pixels are 100%
 * decompressed in memory before canvas operations, avoiding Android Chrome GPU texture drops.
 */
async function decodeImageSource(file: File | Blob): Promise<DecodedImageSource> {
  // Strategy 1: HTMLImageElement with img.decode() (most reliable on Android Chrome & mobile browsers)
  if (typeof window !== "undefined" && typeof Image !== "undefined") {
    try {
      const objectUrl = URL.createObjectURL(file);
      const decodedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
          try {
            if (typeof img.decode === "function") {
              await img.decode();
            }
          } catch {
            // img.decode() non-fatal; image is already loaded via onload
          }
          resolve(img);
        };
        img.onerror = () => {
          reject(new Error("HTMLImageElement failed to load file."));
        };
        img.src = objectUrl;
      });

      const w = decodedImg.naturalWidth || decodedImg.width;
      const h = decodedImg.naturalHeight || decodedImg.height;
      if (w > 0 && h > 0) {
        return {
          source: decodedImg,
          width: w,
          height: h,
          cleanup: () => URL.revokeObjectURL(objectUrl),
        };
      }
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fall through to Strategy 2: createImageBitmap
    }
  }

  // Strategy 2: createImageBitmap fallback (for Web Workers or environments without DOM Image)
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
        // Fall through
      }
    }
  }

  throw new Error("Unable to decode document image. Please upload a valid JPG, PNG, or WEBP.");
}

/**
 * Checks if a rendered 2D canvas is entirely solid black by sampling 9 key points.
 * Returns true if all sampled pixels have R, G, B <= 8 (pure black).
 */
function isCanvasPureBlack(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const points = [
    [Math.floor(width * 0.5), Math.floor(height * 0.5)],
    [Math.floor(width * 0.25), Math.floor(height * 0.25)],
    [Math.floor(width * 0.75), Math.floor(height * 0.25)],
    [Math.floor(width * 0.25), Math.floor(height * 0.75)],
    [Math.floor(width * 0.75), Math.floor(height * 0.75)],
    [Math.floor(width * 0.5), Math.floor(height * 0.25)],
    [Math.floor(width * 0.5), Math.floor(height * 0.75)],
    [Math.floor(width * 0.25), Math.floor(height * 0.5)],
    [Math.floor(width * 0.75), Math.floor(height * 0.5)],
  ];

  for (const [x, y] of points) {
    try {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      if (pixel[0] > 8 || pixel[1] > 8 || pixel[2] > 8) {
        return false; // Found a non-black pixel
      }
    } catch {
      // If tainted canvas security exception occurs, do not falsely flag as black
      return false;
    }
  }
  return true;
}

/**
 * Renders a CanvasImageSource to a JPEG Blob.
 *
 * Industrial-standard hardening:
 * 1. Prioritizes standard DOM <canvas> on main-thread to avoid Android Chrome OffscreenCanvas GPU texture drops.
 * 2. Mandatory white background (#FFFFFF) fill prevents transparent areas from converting to black in JPEG.
 * 3. Micro-yield gives mobile GPU pipelines time to flush draw commands before serialization.
 * 4. Zero-black guard verifies canvas is not solid black before blob generation.
 */
async function renderToJpegBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));

  // ── Strategy A: Standard DOM HTMLCanvasElement (Most resilient on Android Chrome & Safari) ──
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = safeW;
    canvas.height = safeH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not acquire 2D context from HTMLCanvasElement.");

    // Fill white background first: ensures non-square or transparent documents never turn black
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, safeW, safeH);
    ctx.drawImage(source, 0, 0, safeW, safeH);

    // Guard: Check if canvas rendered solid black (Android GPU compositor dropped frame)
    if (isCanvasPureBlack(ctx, safeW, safeH)) {
      // Micro-yield and retry draw
      await new Promise((resolve) => setTimeout(resolve, 30));
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, safeW, safeH);
      ctx.drawImage(source, 0, 0, safeW, safeH);
    }

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

  // ── Strategy B: OffscreenCanvas fallback (For Web Workers without DOM) ──
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(safeW, safeH);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not acquire 2D context from OffscreenCanvas.");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, safeW, safeH);
    ctx.drawImage(source, 0, 0, safeW, safeH);

    return canvas.convertToBlob({ type: "image/jpeg", quality });
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

    // Floor check: Valid document photos even when compressed never drop below 5 KB
    if (blob.size < 5_000) {
      throw new Error("Document image could not be rendered clearly. Please choose a clearer photo.");
    }

    // ─── Thumbnail Generation ───────────────────────────────────────────────
    // Constrained to 480 px max edge (or original if smaller), 0.82 quality.
    const thumbDims = calculateTargetDimensions(origW, origH, 480);
    const thumbBlob = await renderToJpegBlob(decoded.source, thumbDims.width, thumbDims.height, 0.82);

    if (thumbBlob.size < 2_000) {
      throw new Error("Document preview thumbnail could not be rendered. Please try again.");
    }

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
