import {createHash} from "node:crypto";
import {serverEnv} from "./env.js";
import {mapWithConcurrency} from "./http.js";

/**
 * Minimal Cloudinary Upload API client (destroy only), built on fetch.
 * Replaces the full `cloudinary` SDK, which made every function bundle larger
 * and cold starts slower for the single call we need.
 */

export type ResourceType = "image" | "video" | "raw";

export interface CloudinaryAsset {
  url: string;
  resourceType: ResourceType;
  publicId: string;
}

/**
 * Parses a delivery URL of OUR cloud (`https://res.cloudinary.com/<cloud>/<type>/upload/...`)
 * into resource type and public ID. Returns null for anything else.
 */
export function parseCloudinaryUrl(url: string, cloudName: string): CloudinaryAsset | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return null;

  // /<cloud>/<resource_type>/upload/[transformations/][v<version>/]<public_id>[.<ext>]
  const [cloud, resourceType, deliveryType, ...rest] = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  if (cloud !== cloudName || deliveryType !== "upload") return null;
  if (resourceType !== "image" && resourceType !== "video" && resourceType !== "raw") return null;

  // Stored URLs come straight from the upload API, so they always carry a version
  // segment; everything after it is the public ID.
  const versionIndex = rest.findIndex((segment) => /^v\d+$/.test(segment));
  let publicId = (versionIndex >= 0 ? rest.slice(versionIndex + 1) : rest).join("/");
  // Raw files keep their extension as part of the public ID; images and videos do not.
  if (resourceType !== "raw") publicId = publicId.replace(/\.[^./]+$/, "");
  if (!publicId || publicId.split("/").includes("..")) return null;

  return {url, resourceType, publicId};
}

async function destroy(asset: CloudinaryAsset): Promise<void> {
  const {cloudName, apiKey, apiSecret} = serverEnv.cloudinary();
  const params: Record<string, string> = {
    invalidate: "true", // purge CDN copies, so deleted evidence stops being served
    public_id: asset.publicId,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };
  // https://cloudinary.com/documentation/authentication_signatures (default algorithm: SHA-1)
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${asset.resourceType}/destroy`, {
    method: "POST",
    body: new URLSearchParams({...params, api_key: apiKey, signature}),
    signal: AbortSignal.timeout(8000),
  });
  const payload = (await response.json().catch(() => ({}))) as {result?: string; error?: {message?: string}};
  if (!response.ok) throw new Error(`Cloudinary destroy HTTP ${response.status}: ${payload.error?.message ?? ""}`);
  if (payload.result !== "ok" && payload.result !== "not found") {
    throw new Error(`Cloudinary destroy returned "${payload.result}" for ${asset.publicId}`);
  }
}

/** Deletes the given assets (5 requests in flight at most). Never throws; reports per URL. */
export async function destroyAssets(assets: readonly CloudinaryAsset[]) {
  const results = await mapWithConcurrency(assets, 5, destroy);
  const deleted: string[] = [];
  const failed: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") deleted.push(assets[index].url);
    else {
      failed.push(assets[index].url);
      console.error("[cloudinary]", result.reason);
    }
  });
  return {deleted, failed};
}

/** Parses the URLs that belong to our cloud; foreign or malformed URLs are dropped. */
export function toOwnAssets(urls: readonly string[]): CloudinaryAsset[] {
  if (urls.length === 0) return [];
  const {cloudName} = serverEnv.cloudinary();
  return urls.flatMap((url) => parseCloudinaryUrl(url, cloudName) ?? []);
}
