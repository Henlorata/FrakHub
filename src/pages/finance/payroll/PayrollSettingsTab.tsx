import {useEffect, useMemo, useState, type ReactNode} from "react";
import {toast} from "sonner";
import {Award, BadgePercent, Clock, FileText, Loader2, Lock, Medal, Plus, Save, Shield, Trash2, Undo2, Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useAuth} from "@/context/AuthContext";
import {DIVISIONS, FACTION_RANKS, QUALIFICATIONS} from "@shared/ranks";
import {formatDateTime} from "@/lib/datetime";
import {financeApi} from "@/lib/finance";
import {cn, errorMessage} from "@/lib/utils";
import type {PayrollSettings} from "@/types/finance";
import {MoneyField} from "../components/MoneyField";
import {WhatIfPanel} from "./WhatIfPanel";

const COLUMNS = "rank_pay, unit_pay, duty_tiers, min_duty_hours, min_reports, top_duty_pay, top_report_pay, report_pay, picture_pay, training_pay, "
  + "tax_percent, executive_unit, updated_at, updated_by";

/**
 * The pay table of the monthly payroll. The Commander sets the amounts (they change from time
 * to time); a closed month keeps the amounts it was closed with.
 */
export function PayrollSettingsTab({canEdit}: {canEdit: boolean}) {
  const {supabase} = useAuth();
  const [saved, setSaved] = useState<PayrollSettings | null>(null);
  const [draft, setDraft] = useState<PayrollSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    supabase.from("payroll_settings").select(COLUMNS).eq("id", "global").single().then(({data, error}) => {
      if (error || !data) {
        toast.error("A fizetési tábla betöltése nem sikerült.");
        return;
      }
      const row = data as unknown as PayrollSettings;
      const settings = {...row, tax_percent: Number(row.tax_percent)};
      setSaved(settings);
      setDraft(settings);
    });
  }, [supabase]);

  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  if (!draft || !saved) return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{Array.from({length: 4}, (_, index) => <div key={index} className="skeleton h-72"/>)}</div>;

  const set = (patch: Partial<PayrollSettings>) => setDraft((current) => current && {...current, ...patch});
  const unitKeys = [...new Set([draft.executive_unit ?? "", ...DIVISIONS, ...QUALIFICATIONS, ...Object.keys(draft.unit_pay)].filter(Boolean))];

  const save = async () => {
    setSaving(true);
    try {
      const next = await financeApi.saveSettings({
        rank_pay: draft.rank_pay, unit_pay: draft.unit_pay, duty_tiers: [...draft.duty_tiers].sort((a, b) => a.hours - b.hours),
        min_duty_hours: draft.min_duty_hours, min_reports: draft.min_reports, top_duty_pay: draft.top_duty_pay, top_report_pay: draft.top_report_pay,
        report_pay: draft.report_pay, picture_pay: draft.picture_pay, training_pay: draft.training_pay, tax_percent: draft.tax_percent,
        executive_unit: draft.executive_unit,
      });
      const settings = {...next, tax_percent: Number(next.tax_percent)};
      setSaved(settings);
      setDraft(settings);
      toast.success("Fizetési tábla mentve. A nyitott hónapok már ezzel számolnak.");
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-tour="payroll-settings" className="space-y-4 pb-16">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        {canEdit ? (
          <p>A táblát a Commander állítja be. A változás a nyitott hónapokra azonnal érvényes, a lezárt hónapok összegei nem változnak.</p>
        ) : (
          <p className="flex items-center gap-1.5"><Lock className="size-3.5"/> A fizetési táblát a Commander állítja be; te megtekintheted.</p>
        )}
        {saved.updated_at && <p className="ml-auto text-slate-500">Utoljára módosítva: {formatDateTime(saved.updated_at)}</p>}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Section icon={Shield} title="Rendfokozat" hint={`Csak ${draft.min_duty_hours} óra duty időtől jár.`}>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {FACTION_RANKS.map((rank) => (
                <Row key={rank} label={rank}>
                  <MoneyField label={`${rank} fizetése`} disabled={!canEdit} value={draft.rank_pay[rank] ?? 0}
                              onChange={(value) => set({rank_pay: {...draft.rank_pay, [rank]: value}})}/>
                </Row>
              ))}
            </div>
          </Section>
          <Section icon={FileText} title="Teljesítmény" hint="Darabonként, duty időtől függetlenül.">
            <Row label="Jelentésenként"><MoneyField label="Jelentésenként" disabled={!canEdit} value={draft.report_pay} onChange={(value) => set({report_pay: value})}/></Row>
            <Row label="Élményképenként"><MoneyField label="Élményképenként" disabled={!canEdit} value={draft.picture_pay} onChange={(value) => set({picture_pay: value})}/></Row>
            <Row label="Kiképzett személyenként"><MoneyField label="Kiképzett személyenként" disabled={!canEdit} value={draft.training_pay} onChange={(value) => set({training_pay: value})}/></Row>
          </Section>
          <Section icon={BadgePercent} title="Adó" hint="A havi összeg után, az „Adóval együtt” sorhoz.">
            <Row label="Adó mértéke">
              <div className="relative">
                <Input disabled={!canEdit} inputMode="decimal" value={draft.tax_percent} className="h-9 pr-8 text-right font-mono"
                       onChange={(event) => {
                         const value = Number(event.target.value.replace(",", ".").replace(/[^\d.]/g, ""));
                         if (Number.isFinite(value)) set({tax_percent: Math.min(value, 100)});
                       }}/>
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-500">%</span>
              </div>
            </Row>
          </Section>
        </div>
        <div className="space-y-4">
          <Section icon={Users} title="Egység és képesítés" hint="Mindig jár (duty időtől függetlenül). Egy tag egy egység és egy képesítés után kap.">
            <Row label="A vezérkar egysége" hint="Commander és Deputy Commander ezzel fizet, nem az osztályával.">
              <Input disabled={!canEdit} value={draft.executive_unit ?? ""} maxLength={20} placeholder="pl. BM"
                     onChange={(event) => set({executive_unit: event.target.value.toUpperCase() || null})} className="h-9 font-mono"/>
            </Row>
            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {unitKeys.map((key) => {
                const custom = !(DIVISIONS as readonly string[]).includes(key) && !(QUALIFICATIONS as readonly string[]).includes(key) && key !== draft.executive_unit;
                return (
                  <Row key={key} label={key} hint={(QUALIFICATIONS as readonly string[]).includes(key) ? "képesítés" : (DIVISIONS as readonly string[]).includes(key) ? "osztály" : key === draft.executive_unit ? "vezérkar" : "egyéb"}>
                    <div className="flex gap-1">
                      <MoneyField label={`${key} fizetése`} disabled={!canEdit} value={draft.unit_pay[key] ?? 0}
                                  onChange={(value) => set({unit_pay: {...draft.unit_pay, [key]: value}})} className="flex-1"/>
                      {custom && canEdit && (
                        <Button size="icon" variant="ghost" className="size-9" aria-label={`${key} törlése`} onClick={() => {
                          const next = {...draft.unit_pay};
                          delete next[key];
                          set({unit_pay: next});
                        }}><Trash2/></Button>
                      )}
                    </div>
                  </Row>
                );
              })}
            </div>
            {canEdit && (
              <div className="mt-3 flex gap-2">
                <Input value={newKey} onChange={(event) => setNewKey(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20))}
                       placeholder="Új egység (pl. K9)" className="h-9 font-mono"/>
                <Button variant="outline" disabled={!newKey || newKey in draft.unit_pay} onClick={() => {
                  set({unit_pay: {...draft.unit_pay, [newKey]: 0}});
                  setNewKey("");
                }}><Plus/> Hozzáadás</Button>
              </div>
            )}
          </Section>
          <Section icon={Clock} title="Duty idő" hint="A legmagasabb elért sáv összege jár; a minimum alatt se rang-, se duty-fizetés.">
            <Row label="Minimum duty idő">
              <div className="relative">
                <Input disabled={!canEdit} inputMode="numeric" value={draft.min_duty_hours} className="h-9 pr-10 text-right font-mono"
                       onChange={(event) => set({min_duty_hours: Math.min(Number(event.target.value.replace(/\D/g, "") || 0), 744)})}/>
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-500">óra</span>
              </div>
            </Row>
            <Row label="Havi minimum jelentés" hint="A tagok irányítópultján; a fizetést nem érinti.">
              <div className="relative">
                <Input disabled={!canEdit} inputMode="numeric" value={draft.min_reports} className="h-9 pr-10 text-right font-mono" aria-label="Havi minimum jelentés"
                       onChange={(event) => set({min_reports: Math.min(Number(event.target.value.replace(/\D/g, "") || 0), 100)})}/>
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-500">db</span>
              </div>
            </Row>
            <div className="mt-2 space-y-1.5">
              {draft.duty_tiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative w-28">
                    <Input disabled={!canEdit} inputMode="numeric" value={tier.hours} aria-label="Óra" className="h-9 pr-12 text-right font-mono"
                           onChange={(event) => set({duty_tiers: draft.duty_tiers.map((item, i) => i === index ? {...item, hours: Math.min(Number(event.target.value.replace(/\D/g, "") || 0), 744)} : item)})}/>
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-500">óra+</span>
                  </div>
                  <MoneyField label={`${tier.hours} óra fizetése`} disabled={!canEdit} value={tier.pay} className="flex-1"
                              onChange={(value) => set({duty_tiers: draft.duty_tiers.map((item, i) => i === index ? {...item, pay: value} : item)})}/>
                  {canEdit && (
                    <Button size="icon" variant="ghost" className="size-9" aria-label="Sáv törlése"
                            onClick={() => set({duty_tiers: draft.duty_tiers.filter((_, i) => i !== index)})}><Trash2/></Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => {
                  const last = [...draft.duty_tiers].sort((a, b) => b.hours - a.hours)[0];
                  set({duty_tiers: [...draft.duty_tiers, {hours: (last?.hours ?? 20) + 10, pay: (last?.pay ?? 0) + 1_000_000}]});
                }}><Plus/> Sáv</Button>
              )}
            </div>
          </Section>
          <Section icon={Medal} title="TOP helyezések" hint="Automatikusan a duty idő és a jelentésszám alapján; holtversenyben ugyanaz a hely jár.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["top_duty_pay", "top_report_pay"] as const).map((field) => (
                <div key={field} className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Award className="size-3.5 text-amber-300"/>{field === "top_duty_pay" ? "TOP duty" : "TOP jelentés"}
                  </p>
                  {[0, 1, 2].map((place) => (
                    <Row key={place} label={`${place + 1}. hely`}>
                      <MoneyField label={`${field === "top_duty_pay" ? "TOP duty" : "TOP jelentés"} ${place + 1}. hely`} disabled={!canEdit}
                                  value={draft[field][place] ?? 0}
                                  onChange={(value) => set({[field]: [0, 1, 2].map((i) => i === place ? value : draft[field][i] ?? 0)})}/>
                    </Row>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {dirty && <WhatIfPanel saved={saved} draft={draft}/>}

      {canEdit && dirty && (
        <div className="panel animate-rise sticky bottom-4 z-30 flex flex-wrap items-center gap-3 px-4 py-3 ring-1 ring-emerald-500/30">
          <p className="text-sm text-slate-200">Mentetlen módosítások a fizetési táblában.</p>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(saved)} disabled={saving}><Undo2/> Elvetés</Button>
            <Button onClick={() => void save()} disabled={saving} className="bg-emerald-500 text-black hover:bg-emerald-400">
              {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({icon: Icon, title, hint, children}: {icon: typeof Shield; title: string; hint?: string; children: ReactNode}) {
  return (
    <section className="panel animate-rise p-5">
      <header className="mb-4 flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25"><Icon className="size-4"/></div>
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Row({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
  return (
    <label className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 py-0.5")}>
      <span className="min-w-0">
        {/* Wraps instead of cutting: "Deputy Sheriff III." and "Deputy Sheriff Trainee" must stay apart. */}
        <span className="block text-sm leading-tight wrap-break-word text-slate-300">{label}</span>
        {hint && <span className="block truncate text-[10px] text-slate-500" title={hint}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}
