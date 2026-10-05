import {useCallback, useEffect, useMemo, useState} from "react";
import {toast} from "sonner";
import {DISCARD_CHANGES, useConfirm} from "@/components/ConfirmDialog";
import {
  CalendarClock, Check, ChevronLeft, ChevronRight, CircleDollarSign, Download, Landmark, Loader2, Lock, LockOpen, RefreshCw, Save,
  Search, Undo2, Users, Wallet,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {StatCard} from "@/components/layout/StatCard";
import {addMonths, formatDateTime, monthKey, todayKey} from "@/lib/datetime";
import {defaultPayrollMonth, financeApi, formatMoney, parseMoney, type PayrollEntryChange} from "@/lib/finance";
import {computePayroll, inputChanges, inputFromRow} from "@/lib/payroll";
import {formatDuty, isValidAccountNumber, monthLabel, parseDuty} from "@/lib/registry";
import {downloadCsv} from "@/lib/csv";
import {cn, errorMessage} from "@/lib/utils";
import type {PayrollInput, PayrollMonth, PayrollRow} from "@/types/finance";
import {ClosePayrollDialog} from "./ClosePayrollDialog";
import {TreasuryPanel} from "./TreasuryPanel";
import {PayrollMemberDialog} from "./PayrollMemberDialog";
import {cellKey, PayrollTable, type TextField} from "./PayrollTable";

type Filter = "all" | "payable" | "unpaid";

/** Parses a text cell; `undefined` marks an invalid value. */
function parseCell(field: TextField, text: string): Partial<PayrollInput> | undefined {
  const value = text.trim();
  switch (field) {
    case "duty": {
      if (!value) return {duty_minutes: 0};
      const minutes = parseDuty(value);
      return minutes === null ? undefined : {duty_minutes: minutes};
    }
    case "reports":
      if (!value) return {reports: null};
      return /^\d{1,4}$/.test(value) && Number(value) <= 1000 ? {reports: Number(value)} : undefined;
    case "pictures":
    case "trained": {
      if (!value) return {[field]: 0};
      return /^\d{1,4}$/.test(value) && Number(value) <= 1000 ? {[field]: Number(value)} : undefined;
    }
    case "bonus": {
      if (!value) return {bonus: 0};
      const amount = parseMoney(value);
      return amount === null || Math.abs(amount) > 10_000_000_000 ? undefined : {bonus: amount};
    }
  }
}

/**
 * The leadership's monthly payroll: HR, duty time and the report log fill the sheet, only the
 * extras are typed in. Save stores every change in one request; closing the month stores the
 * amounts and notifies the members.
 */
export function PayrollTab() {
  const confirm = useConfirm();
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<PayrollMonth | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState<Record<string, PayrollInput>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paidBusy, setPaidBusy] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");

  const apply = (next: PayrollMonth) => {
    setData(next);
    setInputs({});
    setTexts({});
  };

  const load = useCallback(async (target: string | null) => {
    setLoading(true);
    try {
      let next = await financeApi.payroll(target ?? defaultPayrollMonth([]));
      // First visit: once the previous month is closed, the current one is the one to fill.
      if (!target) {
        const preferred = defaultPayrollMonth(next.months.filter((item) => item.status === "closed").map((item) => item.month));
        if (preferred !== next.month) next = await financeApi.payroll(preferred);
      }
      setMonth(next.month);
      apply(next);
      setSelected(new Set());
      setFailed(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const editable = data?.status === "open";
  const baseInputs = useMemo(() => new Map((data?.rows ?? []).map((row) => [row.user_id, inputFromRow(row)])), [data]);
  const rows = useMemo(() => {
    if (!data) return [];
    return editable ? computePayroll(data.rows, inputs, data.settings) : data.rows;
  }, [data, editable, inputs]);
  const inputOf = useCallback((userId: string) => inputs[userId] ?? baseInputs.get(userId)!, [inputs, baseInputs]);

  const changes = useMemo(() => Object.entries(inputs)
    .map(([userId, input]) => ({userId, diff: inputChanges(baseInputs.get(userId)!, input)}))
    .filter((change) => baseInputs.has(change.userId) && Object.keys(change.diff).length > 0), [inputs, baseInputs]);
  const changedIds = useMemo(() => new Set(changes.map((change) => change.userId)), [changes]);
  const invalid = useMemo(() => new Set(Object.entries(texts)
    .filter(([key, text]) => parseCell(key.split(":")[1] as TextField, text) === undefined).map(([key]) => key)), [texts]);

  const updateInput = (userId: string, patch: Partial<PayrollInput>) =>
    setInputs((current) => ({...current, [userId]: {...(current[userId] ?? baseInputs.get(userId)!), ...patch}}));

  const onText = (userId: string, field: TextField, value: string) => {
    setTexts((current) => ({...current, [cellKey(userId, field)]: value}));
    const parsed = parseCell(field, value);
    if (parsed) updateInput(userId, parsed);
  };
  const onBlurText = (userId: string, field: TextField) => {
    const key = cellKey(userId, field);
    setTexts((current) => {
      if (current[key] === undefined || parseCell(field, current[key]) === undefined) return current;
      const next = {...current};
      delete next[key];
      return next;
    });
  };

  const discard = () => {
    setInputs({});
    setTexts({});
  };

  const save = async () => {
    if (!data || !month) return;
    if (invalid.size > 0) return toast.error("Javítsd a pirossal jelölt cellákat (duty: pl. 95:48).");
    const badAccount = changes.find((change) => change.diff.account_number && !isValidAccountNumber(change.diff.account_number));
    if (badAccount) return toast.error("Hibás számlaszám (formátum: 8-8-8 számjegy).");
    if (changes.length === 0) return;
    const entries: PayrollEntryChange[] = changes.map(({userId, diff}) => ({
      user_id: userId,
      ...diff,
      ...("duty_minutes" in diff ? {duty_minutes: diff.duty_minutes || null} : {}),
    }));
    setSaving(true);
    try {
      apply(await financeApi.savePayroll(month, entries));
      toast.success(`${entries.length} tag adatai mentve.`);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  const setPaid = async (userIds: string[], paid: boolean) => {
    if (!month || userIds.length === 0) return;
    setPaidBusy(new Set(userIds));
    try {
      const next = await financeApi.setPaid(month, userIds, paid);
      setData(next); // unsaved inputs stay
      setSelected(new Set());
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült menteni."));
    } finally {
      setPaidBusy(new Set());
    }
  };

  const changeMonth = async (target: string) => {
    if (changes.length > 0 && !(await confirm({...DISCARD_CHANGES, description: "A hónap mentetlen módosításai elvesznek."}))) return;
    void load(target);
  };

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return rows.filter((row) => (!needle || row.name.toLowerCase().includes(needle) || row.badge_number.includes(needle))
      && (filter === "all" || (filter === "payable" && row.total > 0) || (filter === "unpaid" && row.total > 0 && !row.paid)));
  }, [rows, term, filter]);

  const exportCsv = () => {
    if (!data) return;
    const header = ["Név", "Jelvényszám", "Rendfokozat", "Egység", "Képesítés", "Fizet", "Duty idő", "Jelentések", "Élményképek",
      "Kiképzett", "TOP duty", "TOP jelentés", "Egyéb", "Megjegyzés", "Rang fizetés", "Duty fizetés", "Egység fizetés", "Képesítés fizetés",
      "Jelentés fizetés", "Élménykép fizetés", "Kiképzés", "TOP duty fizetés", "TOP jelentés fizetés", "Összesen", "Számlaszám", "Kifizetve"];
    const lines = rows.map((row) => [row.name, row.badge_number, row.rank, row.unit, row.qualification, row.eligible ? "igen" : "nem",
      formatDuty(row.duty_minutes, true), row.reports, row.pictures, row.trained, row.top_duty || "", row.top_report || "", row.bonus,
      row.bonus_note, row.pay.rank, row.pay.duty, row.pay.unit, row.pay.qualification, row.pay.reports, row.pay.pictures, row.pay.training,
      row.pay.top_duty, row.pay.top_report, row.total, row.account_number, row.paid ? "igen" : "nem"]);
    lines.push([], ["Összesen", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", data.total],
      ["Adóval együtt", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", data.total + data.tax]);
    downloadCsv(`sfsd-fizetes-${data.month.slice(0, 7)}-${todayKey()}.csv`, [header, ...lines]);
  };

  if (failed && !data) {
    return (
      <div className="panel">
        <EmptyState icon={RefreshCw} title="A havi fizetés betöltése nem sikerült."
                    action={<Button variant="outline" onClick={() => void load(month)}><RefreshCw/> Újra</Button>}/>
      </div>
    );
  }
  if (!data || !month) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({length: 4}, (_, index) => <div key={index} className="skeleton h-20"/>)}</div>
        <div className="skeleton h-96"/>
      </div>
    );
  }

  const live = editable ? rows.reduce((sum, row) => sum + row.total, 0) : data.total;
  const tax = Math.round(live * data.settings.tax_percent / 100);
  const payable = rows.filter((row) => row.total > 0);
  const paidRows = rows.filter((row) => row.paid);
  const paidTotal = paidRows.reduce((sum, row) => sum + row.total, 0);
  const isCurrent = month === monthKey();
  const detailRow = detail ? rows.find((row) => row.user_id === detail) : null;
  const selectedIds = [...selected];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Előző hónap" disabled={loading} onClick={() => changeMonth(addMonths(month, -1))}><ChevronLeft/></Button>
          <div className="min-w-44 text-center">
            <p className="text-lg font-semibold text-white">{monthLabel(month)}</p>
            <p className={cn("text-[11px] font-medium", editable ? "text-amber-300" : "text-emerald-300")}>
              {editable ? (isCurrent ? "Folyamatban lévő hónap" : "Nyitott, kitöltésre vár") : `Lezárva · ${formatDateTime(data.closed_at)}${data.closed_by_name ? ` · ${data.closed_by_name}` : ""}`}
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Következő hónap" disabled={loading || isCurrent} onClick={() => changeMonth(addMonths(month, 1))}><ChevronRight/></Button>
          {loading && <Loader2 className="size-4 animate-spin text-slate-500"/>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Button variant="outline" onClick={exportCsv}><Download/> CSV</Button>
          {editable ? (
            <Button className="bg-emerald-500 text-black hover:bg-emerald-400" disabled={changes.length > 0 || saving} data-tour="payroll-close"
                    title={changes.length > 0 ? "Előbb mentsd a módosításokat." : undefined} onClick={() => setClosing(true)}>
              <Lock/> Hónap lezárása
            </Button>
          ) : data.can_edit_settings && (
            <Button variant="outline" onClick={() => setReopening(true)}><LockOpen/> Újranyitás</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon={CircleDollarSign} tone="emerald" label="Összesen" value={formatMoney(live)} hint={`${payable.length} fő kap fizetést`}/>
        <StatCard index={1} icon={Landmark} tone="gold" label={`Adóval együtt (${data.settings.tax_percent}%)`} value={formatMoney(live + tax)}
                  hint={`Adó: ${formatMoney(tax)}`}/>
        <StatCard index={2} icon={Check} tone="blue" label="Kifizetve" value={formatMoney(paidTotal)} hint={`${paidRows.length} / ${payable.length} fő`}/>
        <StatCard index={3} icon={Wallet} tone="slate" label={data.withdrawn !== null ? "Különbözet (ennyi maradt)" : "Hátralévő"}
                  value={formatMoney(data.withdrawn !== null ? live - data.withdrawn : live - paidTotal)}
                  hint={data.withdrawn !== null ? `Kivét: ${formatMoney(data.withdrawn)}` : undefined}/>
      </div>

      <TreasuryPanel key={data.month} payroll={data} cost={live + tax} onSaved={(next) => setData(next)}/>

      {data.note && !editable && (
        <p className="panel px-4 py-3 text-sm text-slate-300 wrap-anywhere"><span className="mr-2 text-slate-500">Megjegyzés:</span>{data.note}</p>
      )}

      <div className="panel relative overflow-hidden" data-tour="payroll-table">
        <div className="flex flex-col gap-3 border-b border-white/5 p-4 lg:flex-row lg:items-center">
          <div className="relative lg:w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Név vagy jelvényszám…" className="pl-9"/>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([["all", "Mindenki"], ["payable", "Fizetést kap"], ["unpaid", "Még nincs kifizetve"]] as [Filter, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilter(value)}
                      className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                        filter === value ? "bg-white/10 text-white ring-white/20" : "text-slate-400 ring-transparent hover:bg-white/5 hover:text-slate-200")}>
                {label}
              </button>
            ))}
          </div>
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 lg:ml-auto">
              <span className="text-xs text-slate-400">{selectedIds.length} kijelölve</span>
              <Button size="sm" variant="outline" onClick={() => void setPaid(selectedIds, false)}>Nincs kifizetve</Button>
              <Button size="sm" onClick={() => void setPaid(selectedIds, true)}><Check/> Kifizetve</Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs text-slate-500 lg:ml-auto">
              <CalendarClock className="size-3.5 shrink-0 text-emerald-400"/>
              {editable ? "Duty idő és számlaszám a HR-nyilvántartásba is mentődik. A jelentések a jelentésnaplóból jönnek." : "A kifizetés jelölése lezárt hónapban is módosítható."}
            </p>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={Users} title="Nincs a szűrésnek megfelelő tag." compact/>
        ) : (
          <PayrollTable rows={visible} inputs={inputOf} settings={data.settings} editable={editable} texts={texts} invalid={invalid}
                        changed={changedIds} selected={selected} paidBusy={paidBusy} onText={onText} onBlurText={onBlurText}
                        onInput={updateInput}
                        onSelect={(ids, on) => setSelected((current) => {
                          const next = new Set(current);
                          ids.forEach((id) => on ? next.add(id) : next.delete(id));
                          return next;
                        })}
                        onPaid={(row: PayrollRow) => void setPaid([row.user_id], !row.paid)}
                        onDetails={setDetail}/>
        )}

        {editable && (changes.length > 0 || invalid.size > 0) && (
          <div className="animate-rise flex flex-wrap items-center gap-3 border-t bg-emerald-500/[0.06] px-4 py-3">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-white">{changes.length}</span> tag adatai módosultak
              {invalid.size > 0 && <span className="ml-2 text-red-300">· {invalid.size} hibás cella</span>}
            </p>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={discard} disabled={saving}><Undo2/> Elvetés</Button>
              <Button onClick={() => void save()} disabled={saving || changes.length === 0}>
                {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
              </Button>
            </div>
          </div>
        )}
      </div>

      {detailRow && (
        <PayrollMemberDialog key={detailRow.user_id} row={detailRow} input={inputOf(detailRow.user_id)} settings={data.settings} editable={editable}
                             onInput={(patch) => {
                               updateInput(detailRow.user_id, patch);
                               // The sheet shows the dialog's values, not a stale text being typed in a cell.
                               setTexts((current) => {
                                 const next = {...current};
                                 (["duty", "reports", "pictures", "trained", "bonus"] as TextField[]).forEach((field) => delete next[cellKey(detailRow.user_id, field)]);
                                 return next;
                               });
                             }}
                             onClose={() => setDetail(null)}/>
      )}

      {closing && (
        <ClosePayrollDialog payroll={{...data, total: live, tax, paid_total: paidTotal}} paidCount={paidRows.length} payableCount={payable.length}
                            onClose={() => setClosing(false)}
                            onConfirm={async (withdrawn, note) => {
                              try {
                                apply(await financeApi.closePayroll(month, withdrawn, note));
                                setClosing(false);
                                toast.success(`${monthLabel(month)} lezárva, a tagok értesítést kaptak.`);
                              } catch (error) {
                                toast.error(errorMessage(error, "A lezárás nem sikerült."));
                              }
                            }}/>
      )}

      <Dialog open={reopening} onOpenChange={setReopening}>
        <DialogContent className="sm:max-w-md">
          <div>
            <DialogTitle className="flex items-center gap-2"><LockOpen className="size-4 text-amber-300"/> {monthLabel(month)} újranyitása</DialogTitle>
            <DialogDescription className="mt-1">
              Az összegek újra a jelenlegi fizetési táblából számolódnak. A beírt adatok és a kifizetés jelölései megmaradnak.
            </DialogDescription>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReopening(false)}>Mégse</Button>
            <Button onClick={async () => {
              try {
                apply(await financeApi.reopenPayroll(month));
                setReopening(false);
                toast.success("A hónap újra szerkeszthető.");
              } catch (error) {
                toast.error(errorMessage(error, "Az újranyitás nem sikerült."));
              }
            }}><LockOpen/> Újranyitás</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
