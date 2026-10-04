import {postApi} from "./api";
import {env} from "./env";
import {compressImage, type CompressOptions} from "./image-compression";

export type UploadKind = "evidence" | "avatar" | "academy";

interface UploadSettings extends CompressOptions {
  /** Cloudinary folder; `scope` is e.g. the Academy page id. Undefined = preset default. */
  folder?: (scope?: string) => string;
  /** `auto` also accepts documents (PDF, DOCX) as raw uploads. */
  resourceType: "image" | "auto";
}

const UPLOAD_SETTINGS: Record<UploadKind, UploadSettings> = {
  // Evidence keeps the preset's default folder, as it always did.
  evidence: {resourceType: "auto", maxDimension: 2560, quality: 0.9},
  avatar: {resourceType: "image", folder: () => "avatars", maxDimension: 512, quality: 0.9},
  academy: {resourceType: "image", folder: (pageId) => `academy/${pageId}`, maxDimension: 1920, quality: 0.88},
};

/**
 * Uploads a file with an unsigned preset and returns its secure URL.
 * Images are resized and converted to WebP in the browser first.
 */
export async function uploadToCloudinary(file: File, kind: UploadKind, scope?: string): Promise<string> {
  const {cloudName, presets} = env.cloudinary;
  const preset = presets[kind];
  if (!cloudName || !preset) throw new Error("Hiányzó Cloudinary konfiguráció (.env).");

  const settings = UPLOAD_SETTINGS[kind];
  const formData = new FormData();
  formData.append("file", await compressImage(file, settings));
  formData.append("upload_preset", preset);
  if (settings.folder) formData.append("folder", settings.folder(scope));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${settings.resourceType}/upload`, {
    method: "POST",
    body: formData,
  });
  const data = (await response.json().catch(() => ({}))) as {secure_url?: string; error?: {message?: string}};
  if (!response.ok || !data.secure_url) throw new Error(data.error?.message ?? "Cloudinary feltöltési hiba.");
  return data.secure_url;
}

const isCloudinaryUrl = (url: string) => url.startsWith("https://res.cloudinary.com/") && url.includes("/upload/");

/** Inserts a delivery transformation into a Cloudinary image URL; other URLs pass through. */
export function withTransformation(url: string | null | undefined, transformation: string): string {
  if (!url) return "";
  if (!isCloudinaryUrl(url) || !url.includes("/image/upload/")) return url;
  return url.replace("/upload/", `/upload/${transformation}/`);
}

/** Square, face-centred avatar in the browser's best format (WebP/AVIF). */
export const getOptimizedAvatarUrl = (url: string | null | undefined, size = 160) =>
  withTransformation(url, `c_fill,g_face,w_${size},h_${size},q_auto,f_auto`);

/** Bounded-width image for inline display; the original stays available for zooming. */
export const getOptimizedImageUrl = (url: string | null | undefined, width = 1600) =>
  withTransformation(url, `c_limit,w_${width},q_auto,f_auto`);

/**
 * Asks the server to delete assets that are no longer referenced (replaced avatar,
 * removed evidence, images dropped from Academy pages). Best effort: failures are
 * logged, never thrown, so they cannot break the user's main action.
 */
export async function deleteCloudinaryAssets(urls: readonly (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(urls.filter((url): url is string => !!url && isCloudinaryUrl(url)))];
  for (let i = 0; i < unique.length; i += 50) {
    try {
      await postApi("/api/delete-image", {urls: unique.slice(i, i + 50)});
    } catch (error) {
      console.warn("Cloudinary clean-up failed:", error);
    }
  }
}
