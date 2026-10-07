import type {CSSProperties} from "react";
import {Eye} from "lucide-react";
import {SignatureMark, SIGNATURE_INK} from "@/components/signature/SignatureMark";
import {formatDateTime} from "@/lib/datetime";
import {IAB_TITLES, type IabTitle} from "@/lib/iab";
import type {MailMessage} from "@/lib/mail";
import type {SignatureData} from "@/lib/signature/geometry";
import {cn} from "@/lib/utils";

/**
 * One letter on paper, in the department's old "public mails" format: from / to / subject on top,
 * the text, then the signature: the writer's own (with name and rank), the IAB's staff list under
 * the bureau's letters, or only the name of an outside sender.
 */
export function Letter({message, subject, signature, iabStaff, reporterSees, index = 0, className}: {
  message: MailMessage;
  subject: string;
  signature?: SignatureData | null;
  iabStaff?: {full_name: string; title: string}[] | null;
  /** A public report's answer that the visitor reads too. */
  reporterSees?: boolean;
  index?: number;
  className?: string;
}) {
  const office = message.sender_kind === "iab" || message.sender_kind === "sib" || message.sender_kind === "command";
  return (
    <article style={{"--i": index} as CSSProperties}
             className={cn("animate-rise relative overflow-hidden rounded-xl bg-[#fbf8f1] text-[#1c1917] shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)] ring-1 ring-black/10 print:shadow-none",
               className)}>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#b08d3c] via-[#b08d3c]/40 to-transparent"/>
      {reporterSees && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-700/25 print:hidden">
          <Eye className="size-3"/> A bejelentő látja
        </span>
      )}
      <header className="space-y-0.5 border-b border-dashed border-[#d6d0c4] px-6 pt-5 pb-3 font-mono text-[12.5px] leading-relaxed">
        <p className="wrap-anywhere"><span className="inline-block w-16 text-[#a8a29e]">from:</span>{message.sender_address}</p>
        <p className="wrap-anywhere"><span className="inline-block w-16 text-[#a8a29e]">to:</span>{message.to.join(", ") || "–"}</p>
        <p className="wrap-anywhere"><span className="inline-block w-16 text-[#a8a29e]">subject:</span><span className="font-semibold">{subject}</span></p>
        <p><span className="inline-block w-16 text-[#a8a29e]">date:</span>{formatDateTime(message.created_at)}</p>
      </header>
      <div className="px-6 py-5 text-[15px] leading-relaxed whitespace-pre-wrap wrap-anywhere">{message.body}</div>
      <footer className="px-6 pb-5">
        {message.sender_kind === "self" ? (
          <div className="max-w-xs">
            <div className="flex h-14 items-end">
              {signature && <SignatureMark signature={signature} title={`${message.sender_name} aláírása`} className="-mb-1 h-full max-w-full" style={{color: SIGNATURE_INK}}/>}
            </div>
            <p className="border-t border-[#a8a29e] pt-1 text-sm font-semibold">{message.sender_name}</p>
            {message.author && <p className="text-xs text-[#57534e]">{message.author.faction_rank} · #{message.author.badge_number}</p>}
          </div>
        ) : message.sender_kind === "iab" && iabStaff?.length ? (
          <div className="text-sm">
            <ul className="space-y-0.5 text-[13px] text-[#44403c]">
              {iabStaff.map((member) => (
                <li key={`${member.title}-${member.full_name}`}>{IAB_TITLES[member.title as IabTitle] ?? member.title} – {member.full_name}</li>
              ))}
            </ul>
            <p className="mt-3">Tisztelettel;</p>
            <p className="font-semibold">Internal Affairs Bureau</p>
          </div>
        ) : (
          <p className="text-sm font-semibold">{message.sender_name}</p>
        )}
        {(office || message.sender_kind === "external") && message.author && (
          <p className="mt-3 text-[10px] text-[#a8a29e] print:hidden">
            {message.sender_kind === "external" ? "Külső levél, rögzítette" : "Írta"}: {message.author.full_name} ({message.author.faction_rank})
          </p>
        )}
      </footer>
    </article>
  );
}
