import type {CSSProperties} from "react";
import {isSignaturePath, type SignatureData} from "@/lib/signature/geometry";
import {cn} from "@/lib/utils";

/** Ink colour on paper (documents, previews). */
export const SIGNATURE_INK = "#1f2f6b";

/**
 * A stored signature (vector outlines). Scales to the box it is given; the colour follows
 * `currentColor`. `draw` replays it as if being written (a sweep from left to right).
 */
export function SignatureMark({signature, className, title, draw = false, style}: {
  signature: SignatureData;
  className?: string;
  title?: string;
  draw?: boolean;
  style?: CSSProperties;
}) {
  if (!isSignaturePath(signature.path)) return null;
  return (
    <svg viewBox={`0 0 ${signature.width} ${signature.height}`} preserveAspectRatio="xMidYMid meet" role="img"
         aria-label={title ?? "Aláírás"} className={cn("block overflow-visible", draw && "signature-write", className)} style={style}>
      <path d={signature.path} fill="currentColor" fillRule="nonzero"/>
    </svg>
  );
}
