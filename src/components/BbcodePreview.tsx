import type {CSSProperties, ReactNode} from "react";
import {cn} from "@/lib/utils";

/**
 * Renders the BBCode the forum understands (the tags of the report templates) roughly like
 * XenForo shows it, so a report can be checked before posting. Builds React elements only:
 * no HTML injection, colours and fonts are validated.
 */

const SIZES: Record<string, string> = {"1": "10px", "2": "12px", "3": "15px", "4": "18px", "5": "22px", "6": "26px", "7": "32px"};
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;
const SAFE_FONT = /^[a-z0-9 ,'-]{1,40}$/i;
const TAG = /\[(\/?)([a-z]+)(?:=([^\]]{1,80}))?\]/gi;

interface Node {
  tag: string | null;
  value?: string;
  children: (Node | string)[];
}

function parse(source: string): Node {
  const root: Node = {tag: null, children: []};
  const stack: Node[] = [root];
  let last = 0;
  for (const match of source.matchAll(TAG)) {
    const [raw, closing, name, value] = match;
    const tag = name.toLowerCase();
    const top = stack[stack.length - 1];
    if (match.index > last) top.children.push(source.slice(last, match.index));
    last = match.index + raw.length;
    if (closing) {
      const index = stack.map((node) => node.tag).lastIndexOf(tag);
      if (index > 0) stack.length = index;
      else top.children.push(raw);
      continue;
    }
    if (!["b", "i", "u", "s", "size", "font", "color", "center", "right", "left", "quote", "img", "url"].includes(tag)) {
      top.children.push(raw);
      continue;
    }
    const node: Node = {tag, value, children: []};
    top.children.push(node);
    stack.push(node);
  }
  if (last < source.length) stack[stack.length - 1].children.push(source.slice(last));
  return root;
}

function textOf(node: Node | string): string {
  return typeof node === "string" ? node : node.children.map(textOf).join("");
}

function render(node: Node | string, key: number): ReactNode {
  if (typeof node === "string") return node;
  const children = node.children.map(render);
  const style: CSSProperties = {};
  switch (node.tag) {
    case null: return <>{children}</>;
    case "b": return <strong key={key}>{children}</strong>;
    case "i": return <em key={key}>{children}</em>;
    case "u": return <u key={key}>{children}</u>;
    case "s": return <s key={key}>{children}</s>;
    case "size":
      style.fontSize = SIZES[node.value ?? ""] ?? undefined;
      return <span key={key} style={style}>{children}</span>;
    case "font":
      if (node.value && SAFE_FONT.test(node.value)) style.fontFamily = node.value;
      return <span key={key} style={style}>{children}</span>;
    case "color":
      if (node.value && SAFE_COLOR.test(node.value.trim())) style.color = node.value.trim();
      return <span key={key} style={style}>{children}</span>;
    case "center": return <div key={key} className="text-center">{children}</div>;
    case "right": return <div key={key} className="text-right">{children}</div>;
    case "left": return <div key={key} className="text-left">{children}</div>;
    case "quote":
      return <blockquote key={key} className="my-1 rounded-md border-l-4 border-[#4a6c94] bg-[#1e2733] px-4 py-3">{children}</blockquote>;
    case "img": {
      const src = textOf(node).trim();
      return /^https:\/\/[^\s"'<>]+$/.test(src)
        ? <img key={key} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="inline-block max-h-40 max-w-full"/>
        : <span key={key}>{src}</span>;
    }
    case "url": {
      const href = (node.value ?? textOf(node)).trim();
      return /^https:\/\//.test(href)
        ? <a key={key} href={href} target="_blank" rel="noreferrer" className="text-sky-400 underline">{children}</a>
        : <span key={key}>{children}</span>;
    }
    default: return <span key={key}>{children}</span>;
  }
}

export function BbcodePreview({source, className}: {source: string; className?: string}) {
  return (
    <div className={cn("whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#d4d8de] wrap-anywhere", className)}
         style={{fontFamily: "'Segoe UI', Arial, sans-serif"}}>
      {render(parse(source), 0)}
    </div>
  );
}
