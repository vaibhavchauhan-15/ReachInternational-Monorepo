/**
 * ReachInternational Client-Side Document Image Compression Utility
 * Implements high-performance canvas compression at pick time.
 * 
 * Rules:
 * 1. createImageBitmap(file, { imageOrientation: "from-image" })
 * 2. Draw to OffscreenCanvas, falling back to <canvas> + toBlob for older Safari
 * 3. Encode JPEG 0.8. If above 400 KB, retry at 0.7, then reduce long edge to 1400 (max 3 passes)
 * 4. Reject if short edge is under 600 px or final result exceeds 1 MB
 * 5. Produce a 320 px thumbnail from the same bitmap
 * 6. Never pass original file bytes through
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
 * Renders an ImageBitmap to a JPEG Blob using OffscreenCanvas (or HTMLCanvasElement fallback).
 */
async function renderToJpegBlob(
  source: ImageBitmap,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D context from OffscreenCanvas.");
    ctx.drawImage(source, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  // Fallback for older Safari or environments without OffscreenCanvas
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D context from HTMLCanvasElement.");
    ctx.drawImage(source, 0, 0, width, height);

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
 * Compresses an image file at pick time, enforcing strict resolution, sizing,
 * multi-pass compression, and thumbnail generation.
 * 
 * Never passes the original file through.
 */
export async function compressImageForUpload(
  file: File | Blob
): Promise<CompressedDocumentResult> {
  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    console.warn("[ImageCompression] createImageBitmap failed to decode image:", err);
    throw new Error("Unsupported image, please choose a JPG or PNG.");
  }

  try {
    const origW = bitmap.width;
    const origH = bitmap.height;

    // Reject if short edge is under 600 px
    const shortEdge = Math.min(origW, origH);
    if (shortEdge < 600) {
      throw new Error("Image resolution is too low. Minimum dimension is 600 px.");
    }

    // ─── Multi-pass compression loop (at most 3 passes) ─────────────
    // Pass 1: maxEdge 1600, quality 0.8
    let dims = calculateTargetDimensions(origW, origH, 1600);
    let blob = await renderToJpegBlob(bitmap, dims.width, dims.height, 0.8);

    // Pass 2: If above 400 KB, retry at 0.7
    if (blob.size > 400_000) {
      blob = await renderToJpegBlob(bitmap, dims.width, dims.height, 0.7);

      // Pass 3: If still above 400 KB, reduce long edge to 1400, quality 0.7
      if (blob.size > 400_000) {
        dims = calculateTargetDimensions(origW, origH, 1400);
        blob = await renderToJpegBlob(bitmap, dims.width, dims.height, 0.7);
      }
    }

    // Reject if final compressed result is over 1 MB
    if (blob.size > 1_000_000) {
      throw new Error("Document image exceeds maximum size of 1 MB.");
    }

    // ─── Produce a 320 px thumbnail from the same bitmap ───────────
    const thumbDims = calculateTargetDimensions(origW, origH, 320);
    const thumbBlob = await renderToJpegBlob(bitmap, thumbDims.width, thumbDims.height, 0.7);

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
    bitmap.close?.();
  }
}
