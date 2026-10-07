import {useEffect, useState, type CSSProperties} from "react";
import {useNavigate, useParams} from "react-router";
import {ArrowLeft, Loader2, Printer} from "lucide-react";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {SIGNATURE_INK, SignatureMark} from "@/components/signature/SignatureMark";
import {formatDate} from "@/lib/datetime";
import {documentsApi, type AwardDocument, type AwardKind, type DocumentPerson} from "@/lib/documents";
import type {SignatureData} from "@/lib/signature/geometry";
import {useSignatures} from "@/lib/signature/api";
import {errorMessage} from "@/lib/utils";

const VOWELS = "AÁEÉIÍOÓÖŐUÚÜŰaáeéiíoóöőuúüű";
/** The Hungarian article before a word ("a" / "az"). */
const article = (word: string) => (VOWELS.includes(word.trim().charAt(0)) ? "az" : "a");

/**
 * A ribbon or a commendation as a certificate on paper, signed by whoever gave it and by the head
 * of the department (one signature when they are the same person). The member prints their own,
 * the staff anyone's.
 */
export function AwardCertificatePage() {
  const {kind = "", id = ""} = useParams<{kind: string; id: string}>();
  const navigate = useNavigate();
  const [award, setAward] = useState<AwardDocument | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const signatureOf = useSignatures([award?.issuer?.id, award?.head?.id]);
  const knownKind = kind === "ribbon" || kind === "commendation";
  const error = knownKind ? loadError : "Ismeretlen irat.";

  useEffect(() => {
    if (!knownKind) return;
    let active = true;
    documentsApi.award(kind as AwardKind, id).then((data) => active && setAward(data),
      (reason) => active && setLoadError(errorMessage(reason, "Az oklevél nem tölthető be.")));
    return () => {
      active = false;
    };
  }, [kind, id, knownKind]);

  useEffect(() => {
    if (award) document.title = `${award.kind === "ribbon" ? "Kitüntetési okirat" : "Dicsérő oklevél"} – ${award.member.full_name}`;
    return () => {
      document.title = "SFSD Intranet";
    };
  }, [award]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/profile?tab=awards"));

  if (error || award === null) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-red-300">{error ?? "Az oklevél nem található (visszavonták vagy törölték)."}</p>
        <Button variant="outline" onClick={back}><ArrowLeft className="size-4"/> Vissza</Button>
      </div>
    );
  }
  if (award === undefined) return <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>;

  const ribbon = award.kind === "ribbon";
  const sameSigner = !award.issuer || award.issuer.id === award.head?.id;
  const color = award.color ?? "#b08d3c";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <Button variant="ghost" onClick={back}><ArrowLeft className="size-4"/> Vissza</Button>
        <p className="ml-auto hidden text-xs text-slate-400 sm:block">Tipp: fekvő tájolásban nyomtasd; „Mentés PDF-ként” is választható.</p>
        <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-200"><Printer className="size-4"/> Nyomtatás / PDF</Button>
      </div>

      <article className="animate-rise relative mx-auto w-full overflow-hidden rounded-sm bg-[#fbf8f1] p-[3%] text-[#1c1917] shadow-2xl sm:aspect-[1.414/1] print:shadow-none">
        <div className="absolute inset-[2%] rounded-sm border-[3px] border-double border-[#b08d3c]/70"/>
        <div className="absolute inset-[3.4%] rounded-sm border border-[#b08d3c]/40"/>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(176_141_60/0.10),transparent_60%)]"/>
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]">
          <SheriffStar detail="seal" className="size-[min(60vw,30rem)]"/>
        </div>

        <div className="relative flex h-full flex-col items-center justify-between gap-5 px-[6%] py-[6%] text-center sm:gap-0 sm:py-[4%]">
          <div className="flex flex-col items-center">
            <SheriffStar className="size-[clamp(48px,8vw,80px)] drop-shadow-[0_3px_6px_rgb(60_40_10/0.35)]"/>
            <p className="mt-2 text-[clamp(9px,1.4vw,13px)] font-semibold tracking-[0.35em] text-[#7c6a3c] uppercase">San Fierro Sheriff&apos;s Department</p>
            <h1 className="mt-1 font-serif text-[clamp(22px,4.4vw,44px)] font-bold tracking-[0.12em] text-[#1c1917] uppercase">
              {ribbon ? "Kitüntetési okirat" : "Dicsérő oklevél"}
            </h1>
          </div>

          <div className="flex w-full flex-col items-center">
            <p className="text-[clamp(10px,1.5vw,15px)] text-[#57534e]">
              {ribbon ? "A San Fierro Sheriff's Department elismerése jeléül" : "A San Fierro Sheriff's Department dicséretben részesíti"}
            </p>
            <p className="mt-1 font-serif text-[clamp(22px,4.4vw,44px)] leading-tight font-semibold wrap-anywhere text-[#0c0a09]">{award.member.full_name}</p>
            <p className="text-[clamp(9px,1.3vw,13px)] text-[#78716c]">{award.member.faction_rank} · #{award.member.badge_number}</p>
            {ribbon ? (
              <>
                <p className="mt-3 text-[clamp(10px,1.5vw,15px)] text-[#57534e]">részére {article(award.title)}</p>
                <div className="mt-2 flex w-full flex-col items-center gap-2">
                  {award.image_url ? (
                    <img src={award.image_url} alt="" className="h-[clamp(28px,5vw,52px)] w-auto object-contain"/>
                  ) : (
                    <span aria-hidden className="relative h-[clamp(14px,2.2vw,22px)] w-[clamp(48px,8vw,84px)] overflow-hidden rounded-[3px] shadow-[0_1px_3px_rgb(0_0_0/0.35)] ring-1 ring-black/30"
                          style={{background: `linear-gradient(90deg, ${color} 0 30%, rgb(255 255 255 / 0.9) 30% 36%, ${color} 36% 64%, rgb(255 255 255 / 0.9) 64% 70%, ${color} 70%)`} as CSSProperties}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/25"/>
                    </span>
                  )}
                  <p className="max-w-[85%] text-[clamp(16px,2.8vw,28px)] font-semibold wrap-anywhere text-[#1c1917]">{award.title}</p>
                </div>
                <p className="mt-1 text-[clamp(10px,1.5vw,15px)] text-[#57534e]">kitüntetést adományozza.</p>
              </>
            ) : (
              <p className="mt-3 max-w-[80%] text-[clamp(16px,2.8vw,28px)] font-semibold wrap-anywhere text-[#1c1917]">{award.title}</p>
            )}
            {award.text && (
              <p className="mt-2 max-w-[75%] font-serif text-[clamp(10px,1.4vw,14px)] text-[#57534e] italic wrap-anywhere">{award.text}</p>
            )}
          </div>

          <div className="grid w-full grid-cols-3 items-end gap-4 text-[clamp(8px,1.2vw,12px)] text-[#57534e]">
            <div className="text-left">
              {sameSigner ? (
                <Signer person={award.head} role={award.head?.title ?? "Az osztály vezetője"} signature={signatureOf(award.head?.id)}/>
              ) : (
                <Signer person={award.issuer} role={ribbon ? "Adományozta" : "Kiállította"} signature={signatureOf(award.issuer?.id)}/>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="grid size-[clamp(56px,10vw,96px)] place-items-center rounded-full border-2 border-[#b08d3c] text-center font-bold tracking-wider text-[#8a6d2c] uppercase">
                <span className="text-[clamp(7px,1vw,10px)] leading-tight">{formatDate(award.date)}<br/>SFSD</span>
              </div>
            </div>
            <div className="text-right">
              {sameSigner ? (
                <>
                  <p className="font-mono font-semibold text-[#1c1917]">№ {award.number}</p>
                  <p className="border-t border-[#a8a29e] pt-0.5">Kelt: {formatDate(award.date)}</p>
                </>
              ) : (
                <Signer person={award.head} role={award.head?.title ?? "Az osztály vezetője"} signature={signatureOf(award.head?.id)} align="right"/>
              )}
            </div>
          </div>
        </div>
      </article>
      {!sameSigner && <p className="mt-2 text-center font-mono text-[11px] text-slate-500">№ {award.number}</p>}
    </div>
  );
}

function Signer({person, role, signature, align = "left"}: {
  person: DocumentPerson | null | undefined; role: string; signature: SignatureData | null | undefined; align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <div className="mb-[clamp(6px,1.4vw,14px)] flex h-[clamp(30px,6vw,58px)] items-end">
        {signature && <SignatureMark signature={signature} title={person ? `${person.full_name} aláírása` : undefined} className="h-full max-w-full" style={{color: SIGNATURE_INK}}/>}
      </div>
      <p className="w-full border-t border-[#a8a29e] pt-0.5">
        <span className="font-semibold text-[#1c1917]">{person?.full_name ?? "–"}</span> · {role}
      </p>
    </div>
  );
}
