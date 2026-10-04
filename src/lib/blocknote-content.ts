interface BlockLike {
  type?: string;
  props?: {url?: unknown};
  children?: unknown;
}

/** Collects the URLs of every image block in a BlockNote document (nested blocks included). */
export function extractImageUrls(content: unknown): string[] {
  const urls: string[] = [];
  const visit = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks as BlockLike[]) {
      if (block?.type === "image" && typeof block.props?.url === "string") urls.push(block.props.url);
      visit(block?.children);
    }
  };
  visit(content);
  return urls;
}

/** BlockNote throws on anything but a non-empty block array as initial content. */
export function toInitialContent<T>(content: unknown): T[] | undefined {
  return Array.isArray(content) && content.length > 0 ? (content as T[]) : undefined;
}
