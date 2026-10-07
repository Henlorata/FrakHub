import type {SignatureData} from "@/lib/signature/geometry";
import {cn} from "@/lib/utils";
import {SIGNATURE_INK, SignatureMark} from "./SignatureMark";

/**
 * A signature block on a printed document: the signature above the line, then the name and the
 * role ("Kiállította", "Jóváhagyta", …). Without a stored signature the line stays empty (it can
 * still be signed by hand); `pending` notes that it is not signed yet.
 */
export function SignatureLine({signature, name, role, detail, date, pending, align = "center", className}: {
  signature: SignatureData | null | undefined;
  name: string | null | undefined;
  role: string;
  detail?: string | null;
  date?: string | null;
  pending?: string | null;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const alignment = align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";
  return (
    <div className={cn("flex min-w-0 flex-col print-break-avoid", alignment, className)}>
      <div className={cn("flex h-16 w-full items-end", align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center")}>
        {pending ? (
          <span className="pb-1 text-xs text-slate-400 italic">{pending}</span>
        ) : signature ? (
          <SignatureMark signature={signature} title={name ? `${name} aláírása` : undefined}
                         className="-mb-1 h-[3.6rem] max-w-full" style={{color: SIGNATURE_INK}}/>
        ) : signature === null && name ? (
          // Not set yet: the line stays empty on paper (it can still be signed by hand).
          <span className="pb-1 text-[10px] text-slate-400 italic print:hidden">nincs megadott aláírás</span>
        ) : null}
      </div>
      <div className="w-full border-t border-slate-500 pt-1">
        <p className="text-sm font-semibold wrap-anywhere text-slate-900">{name || "–"}</p>
        <p className="text-[11px] text-slate-600">{role}{detail ? ` · ${detail}` : ""}</p>
        {date && <p className="text-[11px] text-slate-500">{date}</p>}
      </div>
    </div>
  );
}
