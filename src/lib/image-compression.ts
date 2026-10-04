export interface CompressOptions {
  /** Longest edge in pixels after resizing. */
  maxDimension: number;
  /** WebP quality between 0 and 1. */
  quality: number;
}

const PASSTHROUGH_TYPES = new Set(["image/gif", "image/svg+xml"]);

/**
 * Downscales and re-encodes a raster image as WebP before it is uploaded.
 * Screenshots shrink 5-10x, which saves Cloudinary storage/bandwidth credits and
 * Supabase Storage space (free-tier quotas). Falls back to the original file for
 * non-images, animations, browsers without WebP encoding, or when the result is
 * not actually smaller.
 */
export async function compressImage(file: File, {maxDimension, quality}: CompressOptions): Promise<File> {
  if (!file.type.startsWith("image/") || PASSTHROUGH_TYPES.has(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    // Browsers that cannot encode WebP silently return PNG; keep the original then.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, {type: "image/webp", lastModified: Date.now()});
  } finally {
    bitmap.close();
  }
}
