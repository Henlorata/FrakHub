import {Fragment, type CSSProperties, type ReactNode} from "react";
import {getOptimizedImageUrl} from "@/lib/cloudinary";
import {cn} from "@/lib/utils";

/**
 * Renders a BlockNote document without loading the editor (the public news pages stay light):
 * headings, paragraphs, lists, quotes, check lists, tables, code and pictures with captions.
 * Unknown blocks fall back to their text.
 */

interface InlineText {
  type: "text";
  text: string;
  styles?: {bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean; textColor?: string; backgroundColor?: string};
}
interface InlineLink {
  type: "link";
  href: string;
  content: InlineText[] | string;
}
type Inline = InlineText | InlineLink | {type: string; [key: string]: unknown};

interface Block {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: Inline[] | string | {type: "tableContent"; rows: {cells: (Inline[] | {content?: Inline[]})[]}[]};
  children?: Block[];
}

const COLORS: Record<string, string> = {
  gray: "#94a3b8", brown: "#d6a77a", red: "#f87171", orange: "#fb923c", yellow: "#facc15", green: "#4ade80", blue: "#60a5fa", purple: "#c084fc", pink: "#f472b6",
};

const safeHref = (href: string) => (/^(https?:|mailto:|\/)/i.test(href) ? href : "#");

function renderText(item: InlineText, key: number): ReactNode {
  let node: ReactNode = item.text;
  const styles = item.styles ?? {};
  if (styles.code) node = <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em]">{node}</code>;
  if (styles.bold) node = <strong className="font-semibold text-white">{node}</strong>;
  if (styles.italic) node = <em>{node}</em>;
  if (styles.underline) node = <u>{node}</u>;
  if (styles.strike) node = <s>{node}</s>;
  const color = styles.textColor && styles.textColor !== "default" ? COLORS[styles.textColor] : undefined;
  const background = styles.backgroundColor && styles.backgroundColor !== "default" ? COLORS[styles.backgroundColor] : undefined;
  if (color || background) {
    node = <span style={{color, backgroundColor: background ? `${background}33` : undefined, borderRadius: 4} as CSSProperties}>{node}</span>;
  }
  return <Fragment key={key}>{node}</Fragment>;
}

function renderInline(content: Block["content"]): ReactNode {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  return content.map((item, index) => {
    if (item.type === "text") return renderText(item as InlineText, index);
    if (item.type === "link") {
      const link = item as InlineLink;
      const inner = typeof link.content === "string" ? link.content : link.content.map((part, i) => renderText(part, i));
      const href = safeHref(link.href);
      const external = /^https?:/i.test(href);
      return (
        <a key={index} href={href} className="text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:decoration-amber-300"
           target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{inner}</a>
      );
    }
    const text = (item as {text?: unknown}).text;
    return typeof text === "string" ? <Fragment key={index}>{text}</Fragment> : null;
  });
}

const alignClass = (block: Block) => {
  const align = block.props?.textAlignment;
  return align === "center" ? "text-center" : align === "right" ? "text-right" : align === "justify" ? "text-justify" : undefined;
};

function BlockNode({block}: {block: Block}): ReactNode {
  const children = block.children?.length ? <div className="ml-6 space-y-3">{renderBlocks(block.children)}</div> : null;
  const align = alignClass(block);
  switch (block.type) {
    case "heading": {
      const level = Number(block.props?.level ?? 2);
      const Tag = (level <= 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2";
      return (
        <>
          <Tag className={cn("font-semibold tracking-tight text-white", level <= 1 ? "mt-10 text-2xl sm:text-3xl" : level === 2 ? "mt-8 text-xl sm:text-2xl" : "mt-6 text-lg", align)}>
            {renderInline(block.content)}
          </Tag>
          {children}
        </>
      );
    }
    case "quote":
      return (
        <blockquote className={cn("border-l-2 border-amber-400/70 pl-5 text-lg text-slate-200 italic", align)}>
          {renderInline(block.content)}{children}
        </blockquote>
      );
    case "checkListItem":
      return (
        <div className="flex items-start gap-2.5">
          <span className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded border text-[10px]",
            block.props?.checked ? "border-emerald-400 bg-emerald-400/20 text-emerald-300" : "border-slate-500")}>{block.props?.checked ? "✓" : ""}</span>
          <div className="min-w-0">{renderInline(block.content)}{children}</div>
        </div>
      );
    case "codeBlock":
      return <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-sm text-slate-200 ring-1 ring-white/10">{renderInline(block.content)}</pre>;
    case "image": {
      const url = typeof block.props?.url === "string" ? block.props.url : "";
      if (!/^https:\/\//.test(url)) return null;
      const caption = typeof block.props?.caption === "string" ? block.props.caption : "";
      return (
        <figure className="my-2">
          <img src={getOptimizedImageUrl(url, 1400) || url} alt={caption} loading="lazy" decoding="async"
               className="w-full rounded-2xl bg-white/5 object-cover ring-1 ring-white/10"/>
          {caption && <figcaption className="mt-2 text-center text-xs text-slate-500">{caption}</figcaption>}
        </figure>
      );
    }
    case "table": {
      const table = block.content as {rows?: {cells: (Inline[] | {content?: Inline[]})[]}[]} | undefined;
      if (!table?.rows?.length) return null;
      return (
        <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
          <table className="w-full text-sm">
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={cn("border-b border-white/5", rowIndex === 0 && "bg-white/[0.04] font-semibold text-white")}>
                  {row.cells.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top">{renderInline(Array.isArray(cell) ? cell : cell.content)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "paragraph":
    default: {
      const inline = renderInline(block.content);
      const empty = !block.content || (Array.isArray(block.content) && block.content.length === 0);
      if (empty && !children) return <div className="h-2" aria-hidden/>;
      return <><p className={align}>{inline}</p>{children}</>;
    }
  }
}

/** Groups consecutive list items into one list. */
function renderBlocks(blocks: Block[]): ReactNode[] {
  const out: ReactNode[] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (block.type === "bulletListItem" || block.type === "numberedListItem") {
      const kind = block.type;
      const items: Block[] = [];
      while (index < blocks.length && blocks[index].type === kind) items.push(blocks[index++]);
      const List = kind === "numberedListItem" ? "ol" : "ul";
      out.push(
        <List key={items[0].id ?? `list-${index}`} className={cn("space-y-1.5 pl-6 marker:text-amber-300/80", kind === "numberedListItem" ? "list-decimal" : "list-disc")}>
          {items.map((item, itemIndex) => (
            <li key={item.id ?? itemIndex}>
              {renderInline(item.content)}
              {item.children?.length ? <div className="mt-1.5 space-y-1.5">{renderBlocks(item.children)}</div> : null}
            </li>
          ))}
        </List>,
      );
      continue;
    }
    out.push(<BlockNode key={block.id ?? `block-${index}`} block={block}/>);
    index++;
  }
  return out;
}

export function BlockRenderer({blocks, className}: {blocks: unknown[]; className?: string}) {
  return (
    <div className={cn("space-y-4 text-[17px] leading-[1.75] text-slate-300 wrap-anywhere", className)}>
      {renderBlocks(Array.isArray(blocks) ? (blocks as Block[]) : [])}
    </div>
  );
}
