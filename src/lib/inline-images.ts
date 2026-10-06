import {uploadToCloudinary, type UploadKind} from "./cloudinary";

/**
 * Images pasted from other documents arrive in BlockNote as `data:` URLs, so they were stored
 * inside the page JSON (a few MB each): every page view downloaded them from the database
 * (egress) and the database grew. Before saving, such images are uploaded to Cloudinary (like
 * an uploaded file) and the block points to the uploaded copy.
 */

interface ImageBlock {
  type?: string;
  props?: Record<string, unknown> & {url?: unknown};
  children?: unknown;
}

const isDataImage = (value: unknown): value is string => typeof value === "string" && value.startsWith("data:image/");

/** Number of embedded (`data:`) images in a BlockNote document. */
export function countInlineImages(content: unknown): number {
  let count = 0;
  const visit = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks as ImageBlock[]) {
      if (block?.type === "image" && isDataImage(block.props?.url)) count += 1;
      visit(block?.children);
    }
  };
  visit(content);
  return count;
}

async function dataUrlToFile(dataUrl: string, index: number): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return new File([blob], `beillesztett-kep-${index + 1}.${extension}`, {type: blob.type || "image/png"});
}

/**
 * A copy of the document with every embedded image uploaded (the same picture used twice is
 * uploaded once). Throws when an upload fails, so nothing is saved half-converted.
 */
export async function uploadInlineImages<T>(content: T, kind: UploadKind, scope?: string): Promise<{content: T; uploaded: number}> {
  if (countInlineImages(content) === 0) return {content, uploaded: 0};
  const copy = structuredClone(content);
  const uploads = new Map<string, Promise<string>>();
  let index = 0;

  const visit = async (blocks: unknown): Promise<void> => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks as ImageBlock[]) {
      if (block?.type === "image" && block.props && isDataImage(block.props.url)) {
        const source = block.props.url;
        if (!uploads.has(source)) {
          const position = index++;
          uploads.set(source, dataUrlToFile(source, position).then((file) => uploadToCloudinary(file, kind, scope)));
        }
        block.props.url = await uploads.get(source)!;
      }
      await visit(block?.children);
    }
  };
  await visit(copy);
  return {content: copy, uploaded: uploads.size};
}
