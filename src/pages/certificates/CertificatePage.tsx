import {useEffect, useState, type FormEvent} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {toast} from "sonner";
import {ArrowLeft, BadgeCheck, Copy, Loader2, Printer, Search, ShieldAlert, ShieldX} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {AppBackdrop} from "@/components/layout/AppBackdrop";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useAuth} from "@/context/AuthContext";
import {CERTIFICATE_KIND, certificateTitle, certificateUrl, normalizeCertificateCode, recognitionApi, type VerifiedCertificate} from "@/lib/recognition";
import {formatDate} from "@/lib/datetime";
import {cn} from "@/lib/utils";

const INTRO: Record<VerifiedCertificate["kind"], string> = {
  exam: "sikeres vizsgát tett:",
  qualification: "megszerezte a képesítést:",
  rank: "kinevezést kapott a rendfokozatba:",
  scenario: "sikeresen teljesítette a szituációs gyakorlatot:",
};

/**
 * Public check of a certificate code (also without signing in, e.g. from a forum post): the
 * certificate itself as a printable page, or why it is not valid.
 */
export function CertificatePage() {
  const {code: raw = ""} = useParams<{code: string}>();
  const navigate = useNavigate();
  const {user} = useAuth();
  const code = normalizeCertificateCode(raw);
  const [state, setState] = useState<{status: "idle" | "loading" | "missing" | "found"; certificate?: VerifiedCertificate}>({status: code ? "loading" : "idle"});
  const [input, setInput] = useState(raw);

  useEffect(() => {
    if (!code) {
      setState({status: "idle"});
      return;
    }
    let active = true;
    setState({status: "loading"});
    recognitionApi.verify(code).then((certificate) => {
      if (active) setState(certificate ? {status: "found", certificate} : {status: "missing"});
    }).catch(() => active && setState({status: "missing"}));
    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (state.certificate) document.title = `Oklevél ${state.certificate.code}`;
    return () => {
      document.title = "SFSD Intranet";
    };
  }, [state.certificate]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = normalizeCertificateCode(input);
    if (!next) return toast.error("A kód így néz ki: SFSD-1A2B-3C4D.");
    navigate(`/certificates/${next}`);
  };

  const certificate = state.certificate;
  return (
    <>
      <AppBackdrop/>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-8 print:p-0">
        <header className="flex flex-wrap items-center gap-3 print:hidden">
          <Link to={user ? "/dashboard" : "/login"} className="flex items-center gap-3">
            <SheriffStar className="size-9 drop-shadow-[0_0_14px_rgb(234_179_8/0.45)]"/>
            <span className="text-sm font-semibold text-white">SFSD Intranet</span>
          </Link>
          <form onSubmit={submit} className="ml-auto flex w-full gap-2 sm:w-auto">
            <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="SFSD-XXXX-XXXX" aria-label="Oklevél kódja"
                   className="font-mono uppercase sm:w-56"/>
            <Button type="submit" variant="outline"><Search/> Ellenőrzés</Button>
          </form>
        </header>

        {state.status === "idle" && (
          <div className="panel animate-rise mx-auto mt-10 max-w-md p-8 text-center">
            <BadgeCheck className="mx-auto size-12 text-amber-300"/>
            <h1 className="mt-3 text-xl font-semibold text-white">Oklevél ellenőrzése</h1>
            <p className="mt-2 text-sm text-slate-400">Írd be az oklevélen szereplő kódot (például SFSD-1A2B-3C4D), és megmutatjuk, kié és érvényes-e.</p>
          </div>
        )}
        {state.status === "loading" && <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>}
        {state.status === "missing" && (
          <div className="panel animate-rise mx-auto mt-10 max-w-md p-8 text-center">
            <ShieldX className="mx-auto size-12 text-red-400"/>
            <h1 className="mt-3 text-xl font-semibold text-white">Ismeretlen kód</h1>
            <p className="mt-2 text-sm text-slate-400">Nincs ilyen oklevél: <span className="font-mono text-slate-200">{code ?? raw}</span>. Ellenőrizd, jól írtad-e be.</p>
          </div>
        )}
        {certificate && (
          <>
            <div className={cn("flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 print:hidden",
              certificate.valid ? "bg-emerald-500/10 text-emerald-100 ring-emerald-500/30" : "bg-red-500/10 text-red-100 ring-red-500/30")}>
              {certificate.valid ? <BadgeCheck className="size-5 text-emerald-300"/> : <ShieldAlert className="size-5 text-red-300"/>}
              <span className="min-w-0 flex-1">
                {certificate.valid ? "Hiteles, érvényes oklevél." : `Visszavont oklevél (${formatDate(certificate.revoked_at)}): már nem érvényes.`}
              </span>
              <Button size="sm" variant="ghost" onClick={() => {
                void navigator.clipboard.writeText(certificateUrl(certificate.code));
                toast.success("Az ellenőrző link a vágólapon.");
              }}><Copy/> Link</Button>
              <Button size="sm" onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-200"><Printer/> Nyomtatás</Button>
            </div>
            <CertificateSheet certificate={certificate}/>
            {user && (
              <Link to="/profile?tab=certificates" className="mx-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white print:hidden">
                <ArrowLeft className="size-3.5"/> Okleveleim
              </Link>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** The certificate on paper (printable; a revoked one carries a stamp across). */
export function CertificateSheet({certificate}: {certificate: VerifiedCertificate}) {
  const kind = CERTIFICATE_KIND[certificate.kind];
  return (
    // The paper ratio from tablet width up; on a phone the sheet grows with its text instead of cutting it off.
    <article className="animate-rise relative mx-auto w-full max-w-4xl overflow-hidden rounded-sm bg-[#fbf8f1] p-[3%] text-[#1c1917] shadow-2xl sm:aspect-[1.414/1] print:max-w-none print:shadow-none">
      <div className="absolute inset-[2%] rounded-sm border-[3px] border-double border-[#b08d3c]/70"/>
      <div className="absolute inset-[3.4%] rounded-sm border border-[#b08d3c]/40"/>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(176_141_60/0.10),transparent_60%)]"/>
      <div className="relative flex h-full flex-col items-center justify-between gap-5 px-[6%] py-[6%] text-center sm:gap-0 sm:py-[4%]">
        <div className="flex flex-col items-center">
          <SheriffStar className="size-[clamp(48px,9vw,84px)] drop-shadow-[0_4px_12px_rgb(176_141_60/0.45)]"/>
          <p className="mt-2 text-[clamp(9px,1.4vw,13px)] font-semibold tracking-[0.35em] text-[#7c6a3c] uppercase">San Fierro Sheriff&apos;s Department</p>
          <h1 className="mt-1 font-serif text-[clamp(22px,4.6vw,46px)] font-bold tracking-[0.12em] text-[#1c1917] uppercase">{kind.label}</h1>
        </div>
        <div className="flex w-full flex-col items-center">
          <p className="text-[clamp(10px,1.5vw,15px)] text-[#57534e]">Ezennel igazoljuk, hogy</p>
          <p className="mt-1 font-serif text-[clamp(22px,4.4vw,44px)] leading-tight font-semibold wrap-anywhere text-[#0c0a09]">{certificate.holder.full_name}</p>
          <p className="text-[clamp(9px,1.3vw,13px)] text-[#78716c]">{certificate.holder.faction_rank} · #{certificate.holder.badge_number}</p>
          <p className="mt-3 text-[clamp(10px,1.5vw,15px)] text-[#57534e]">{INTRO[certificate.kind]}</p>
          <p className="mt-1 max-w-[80%] text-[clamp(14px,2.6vw,26px)] font-semibold wrap-anywhere text-[#1c1917]">{certificateTitle(certificate)}</p>
          {certificate.subtitle && certificate.kind !== "qualification" && certificate.kind !== "rank" && (
            <p className="text-[clamp(9px,1.3vw,13px)] text-[#78716c]">{certificate.subtitle}</p>
          )}
        </div>
        <div className="grid w-full grid-cols-3 items-end gap-4 text-[clamp(8px,1.2vw,12px)] text-[#57534e]">
          <div className="text-left">
            <p className="font-semibold text-[#1c1917]">{formatDate(certificate.issued_at)}</p>
            <p className="border-t border-[#a8a29e] pt-0.5">Kiállítás napja</p>
          </div>
          <div className="flex justify-center">
            <div className={cn("grid size-[clamp(56px,10vw,96px)] place-items-center rounded-full border-2 text-center font-bold tracking-wider uppercase",
              certificate.valid ? "border-[#b08d3c] text-[#8a6d2c]" : "border-[#b91c1c] text-[#b91c1c]")}>
              <span className="text-[clamp(7px,1vw,10px)] leading-tight">{certificate.valid ? "Hiteles" : "Érvénytelen"}<br/>SFSD</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold text-[#1c1917]">{certificate.code}</p>
            <p className="border-t border-[#a8a29e] pt-0.5">Ellenőrzés: {window.location.host}/certificates</p>
          </div>
        </div>
      </div>
      {!certificate.valid && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-12 rounded-xl border-[6px] border-[#b91c1c]/70 px-8 py-3 text-[clamp(28px,7vw,72px)] font-black tracking-[0.2em] text-[#b91c1c]/70 uppercase">
            Visszavonva
          </span>
        </div>
      )}
    </article>
  );
}
