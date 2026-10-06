import {useEffect, useState, type CSSProperties} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {Award, BadgeCheck, Copy, ExternalLink} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {CERTIFICATE_KIND, certificateTitle, certificateUrl, recognitionApi, type Certificate} from "@/lib/recognition";
import {formatDate} from "@/lib/datetime";
import {cn} from "@/lib/utils";

/** The member's certificates (exams, qualifications, appointments, scenarios) with their check codes. */
export function CertificatesTab() {
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    recognitionApi.myCertificates().then(setCertificates).catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="panel"><EmptyState icon={Award} title="Az oklevelek nem tölthetők be." compact/></div>;
  if (!certificates) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-32"/>)}</div>;
  if (certificates.length === 0) {
    return (
      <div className="panel">
        <EmptyState icon={Award} title="Még nincs oklevelem." compact
                    description={<>Oklevelet a sikeres vizsga, egy új képesítés, egy kinevezés és egy teljesített szituációs gyakorlat ad. <Link to="/practice" className="text-primary hover:underline">Gyakorlás</Link></>}/>
      </div>
    );
  }
  return (
    <div className="space-y-3" data-tour="profile-certificates">
      <p className="text-xs text-slate-500">Bárki ellenőrizheti a kóddal, belépés nélkül is: <span className="font-mono text-slate-300">{window.location.host}/certificates</span></p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {certificates.map((certificate, index) => {
          const kind = CERTIFICATE_KIND[certificate.kind];
          const revoked = !!certificate.revoked_at;
          return (
            <article key={certificate.code} style={{"--i": Math.min(index, 10)} as CSSProperties}
                     className={cn("panel lift animate-rise relative flex min-w-0 flex-col overflow-hidden p-4", revoked && "opacity-60")}>
              <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-amber-400/10 blur-2xl"/>
              <div className="relative flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300/25 to-yellow-600/10 text-amber-200 ring-1 ring-amber-400/30">
                  {revoked ? <Award className="size-5"/> : <BadgeCheck className="size-5"/>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[11px] font-semibold tracking-wide uppercase", kind.tone)}>{kind.label}</p>
                  <h3 className="text-sm font-semibold wrap-anywhere text-white">{certificateTitle(certificate)}</h3>
                  <p className="text-[11px] text-slate-500">{formatDate(certificate.issued_at)}{revoked ? ` · visszavonva ${formatDate(certificate.revoked_at)}` : ""}</p>
                </div>
              </div>
              <div className="relative mt-auto flex items-center gap-1 pt-3">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">{certificate.code}</span>
                <Button size="icon-sm" variant="ghost" title="Ellenőrző link másolása" onClick={() => {
                  void navigator.clipboard.writeText(certificateUrl(certificate.code));
                  toast.success("Az ellenőrző link a vágólapon.");
                }}><Copy/></Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link to={`/certificates/${certificate.code}`}><ExternalLink/> Megnyitás</Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
