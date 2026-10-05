import {useState} from "react";
import {AlertTriangle, Check, ClipboardList, Copy, FileText, Gavel, Info, Minus, Plus, Save, Trash2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Slider} from "@/components/ui/slider";
import {formatCurrency} from "@/lib/penalcode-processor";
import {cn} from "@/lib/utils";
import type {CartItem, Summary} from "./penal-data";

interface SentencePanelProps {
  cart: CartItem[];
  summary: Summary;
  fine: number;
  jail: number;
  onFine: (value: number) => void;
  onJail: (value: number) => void;
  onChange: (id: string, delta: number) => void;
  onClear: () => void;
  onSaveTemplate: () => void;
  reasons: string;
  arrest: string;
  targetId: string;
  onTargetId: (value: string) => void;
  copied: string | null;
  onCopy: (what: "fine" | "reasons" | "arrest" | "ticket") => void;
  onReport: () => void;
}

/** The record (jegyzőkönyv), the sentence within the ranges and the in-game commands. */
export function SentencePanel(props: SentencePanelProps) {
  const {cart, summary, fine, jail, onFine, onJail, onChange, onClear, onSaveTemplate, reasons, arrest, targetId, onTargetId, copied, onCopy, onReport} = props;
  const count = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const licence = summary.warnings.filter((item) => item.warningType.includes("license"));
  const firearm = summary.warnings.filter((item) => item.warningType.includes("firearm"));
  const empty = cart.length === 0;

  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden" data-cart={count}>
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <ClipboardList className="size-4 text-sky-300"/>
          <h3 className="font-semibold text-white">Jegyzőkönyv</h3>
          {count > 0 && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200 ring-1 ring-sky-500/25">{count} tétel</span>}
          {!empty && (
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onSaveTemplate}><Save/> Sablon</Button>
              <Button size="icon" variant="ghost" className="size-7 text-red-300 hover:bg-red-500/10" aria-label="Jegyzőkönyv ürítése" onClick={onClear}><Trash2/></Button>
            </div>
          )}
        </header>
        {empty ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <ClipboardList className="size-9 text-slate-700"/>
            <p className="text-sm text-slate-400">A jegyzőkönyv üres.</p>
            <p className="text-xs text-slate-600">Adj hozzá tételeket a listából (kereséshez nyomd meg a / billentyűt).</p>
          </div>
        ) : (
          <ul className="max-h-[32vh] divide-y divide-white/5 overflow-y-auto">
            {cart.map(({item, quantity}) => (
              <li key={item.id} className="group flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">{item.fo_tetel_nev || item.kategoria_nev}</p>
                  <p className="flex items-center gap-1.5 text-sm text-white">
                    <span className="truncate">{item.megnevezes}</span>
                    {item.isWarning && <AlertTriangle className="size-3 shrink-0 text-amber-400"/>}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {item.paragrafus} · {item.rovidites}
                    {typeof item.max_birsag === "number" && <> · <span className="text-emerald-300/80">{formatCurrency(item.max_birsag)}</span></>}
                    {typeof item.max_fegyhaz === "number" && item.max_fegyhaz > 0 && <> · <span className="text-red-300/80">{item.max_fegyhaz} p</span></>}
                  </p>
                </div>
                <div className="flex h-7 items-center rounded-md ring-1 ring-white/10">
                  <button type="button" onClick={() => onChange(item.id, -1)} aria-label="Kevesebb" className="grid h-full w-6 place-items-center text-slate-400 hover:bg-white/5"><Minus className="size-3"/></button>
                  <span className="w-6 text-center font-mono text-xs font-semibold text-white tabular-nums">{quantity}</span>
                  <button type="button" onClick={() => onChange(item.id, 1)} aria-label="Több" className="grid h-full w-6 place-items-center text-slate-400 hover:bg-white/5"><Plus className="size-3"/></button>
                </div>
                <button type="button" onClick={() => onChange(item.id, -quantity)} aria-label="Törlés"
                        className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-red-500/10 hover:text-red-300"><X className="size-4"/></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-tour="calc-sentence" className="panel space-y-5 p-4">
        <header className="flex items-center gap-2">
          <Gavel className="size-4 text-amber-300"/>
          <h3 className="font-semibold text-white">Kiszabás</h3>
        </header>

        {summary.warnings.length > 0 && (
          <div className="rounded-xl bg-amber-500/[0.07] p-3 text-xs ring-1 ring-amber-500/25">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-amber-200"><AlertTriangle className="size-3.5"/> Figyelj ezekre</p>
            <div className={cn("grid gap-3 text-amber-100/80", licence.length > 0 && firearm.length > 0 && "grid-cols-2")}>
              {licence.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-amber-100">Jogosítvány / forgalmi</p>
                  <ul className="space-y-0.5">{licence.map((item) => <li key={item.id} className="border-l-2 border-amber-500/50 pl-2">{item.megnevezes}</li>)}</ul>
                </div>
              )}
              {firearm.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-red-100">Fegyverengedély</p>
                  <ul className="space-y-0.5">{firearm.map((item) => <li key={item.id} className="border-l-2 border-red-500/50 pl-2">{item.megnevezes}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}
        {summary.specialNotes.length > 0 && (
          <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-slate-300 ring-1 ring-white/10">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-200"><Info className="size-3.5 text-sky-300"/> Külön szabály</p>
            <ul className="space-y-0.5">{summary.specialNotes.map((note) => <li key={note}>{note}</li>)}</ul>
          </div>
        )}

        <Range label="Bírság" tone="emerald" disabled={empty} value={fine} min={summary.minFine} max={summary.maxFine} step={1000}
               display={formatCurrency} onValue={onFine}/>
        <Range label="Fegyház (perc)" tone="red" disabled={empty || summary.maxJail === 0} value={jail} min={summary.minJail} max={summary.maxJail} step={1}
               display={(value) => `${value} perc`} onValue={onJail}/>

        <div className="space-y-2 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ticket (bírság)</p>
            <button type="button" onClick={() => onCopy("ticket")} className="rounded-md px-2 py-0.5 font-mono text-[11px] text-slate-400 ring-1 ring-white/10 hover:bg-white/5 hover:text-white">
              {copied === "ticket" ? "másolva" : "/ticket"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" disabled={empty} onClick={() => onCopy("fine")}>
              {copied === "fine" ? <Check className="text-emerald-400"/> : <Copy/>} Összeg
            </Button>
            <Button variant="outline" size="sm" disabled={!reasons} onClick={() => onCopy("reasons")}>
              {copied === "reasons" ? <Check className="text-emerald-400"/> : <Copy/>} Indoklás
            </Button>
          </div>
          <p className="min-h-10 rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-slate-300 ring-1 ring-white/5 wrap-anywhere">
            {reasons || <span className="text-slate-600">Nincsenek indokok.</span>}
          </p>
        </div>

        <div className={cn("space-y-2 border-t border-white/5 pt-4 transition-opacity", !arrest && "opacity-60")}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Arrest (fegyház)</p>
            <Input value={targetId} onChange={(event) => onTargetId(event.target.value)} placeholder="ID" aria-label="A gyanúsított azonosítója"
                   className="h-7 w-20 text-center font-mono text-xs"/>
          </div>
          <div className="flex items-start gap-2">
            <p className="min-h-10 flex-1 rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-slate-300 ring-1 ring-white/5 wrap-anywhere">
              {arrest || <span className="text-slate-600">Nincs fegyházbüntetés.</span>}
            </p>
            <Button size="sm" disabled={!arrest} onClick={() => onCopy("arrest")}
                    className={copied === "arrest" ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-red-600 text-white hover:bg-red-500"}>
              {copied === "arrest" ? <Check/> : <Copy/>}
            </Button>
          </div>
        </div>

        <Button variant="outline" className="w-full" disabled={empty} onClick={onReport} data-tour="calc-report">
          <FileText/> Jelentés készítése ezekkel
        </Button>
      </section>
    </div>
  );
}

function Range({label, tone, disabled, value, min, max, step, display, onValue}: {
  label: string;
  tone: "emerald" | "red";
  disabled: boolean;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (value: number) => string;
  onValue: (value: number) => void;
}) {
  const fixed = min === max;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className={cn("font-mono text-[11px]", tone === "emerald" ? "text-emerald-300/80" : "text-red-300/80")}>{display(min)} – {display(max)}</span>
      </div>
      <div className="flex items-center gap-3">
        <Slider className="flex-1" min={min} max={Math.max(max, min)} step={step} value={[value]} disabled={disabled || fixed}
                onValueChange={(next) => onValue(next[0])}/>
        <NumberBox value={value} disabled={disabled} tone={tone} onValue={onValue} label={label}/>
      </div>
    </div>
  );
}

const grouped = new Intl.NumberFormat("hu-HU");

/** Typed freely; the value is applied (and kept within the range) when the field is left. */
function NumberBox({value, disabled, tone, onValue, label}: {value: number; disabled: boolean; tone: "emerald" | "red"; onValue: (value: number) => void; label: string}) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text !== null) onValue(Number(text.replace(/\D/g, "") || 0));
    setText(null);
  };
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      disabled={disabled}
      value={text ?? (value > 0 ? grouped.format(value) : "")}
      placeholder="0"
      onFocus={(event) => event.target.select()}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
        setText(digits ? grouped.format(Number(digits)) : "");
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={cn("h-9 w-28 rounded-md bg-white/[0.03] px-2.5 text-right font-mono text-sm tabular-nums ring-1 ring-white/10 outline-none focus:ring-2 disabled:opacity-50",
        tone === "emerald" ? "text-emerald-200 focus:ring-emerald-400/60" : "text-red-200 focus:ring-red-400/60")}
    />
  );
}
