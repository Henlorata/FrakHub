import {Fragment, useMemo, useState} from "react";
import {Link} from "react-router";
import {Check, KeyRound, Minus, ScrollText, User} from "lucide-react";
import {Switch} from "@/components/ui/switch";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {MATRIX, MATRIX_ROLES, type Capability} from "@/lib/permissions-matrix";
import {cn} from "@/lib/utils";

function Cell({value, mine}: {value: Capability; mine?: boolean}) {
  if (value === true) {
    return <span className={cn("mx-auto grid size-6 place-items-center rounded-full", mine ? "bg-emerald-500 text-[#04120c]" : "bg-emerald-500/15 text-emerald-300")}
                 aria-label="Igen"><Check className="size-3.5"/></span>;
  }
  if (value === false) return <Minus className="mx-auto size-3.5 text-slate-700" aria-label="Nem"/>;
  return <span className={cn("mx-auto inline-block rounded-md px-1.5 py-0.5 text-[10px] leading-tight font-medium whitespace-nowrap ring-1",
    mine ? "bg-amber-500/20 text-amber-100 ring-amber-500/40" : "bg-amber-500/10 text-amber-200 ring-amber-500/20")}>{value}</span>;
}

/**
 * Who can do what on the site: one table from the same permission rules the pages use (and the
 * database enforces), with the viewer's own column first.
 */
export function PermissionsPage() {
  const {profile} = useAuth();
  const [onlyMine, setOnlyMine] = useState(false);
  const groups = useMemo(() => MATRIX.map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({...row, mine: profile ? row.check(profile) : false, values: MATRIX_ROLES.map((role) => row.check(role.profile))}))
      .filter((row) => !onlyMine || row.mine !== false),
  })).filter((group) => group.rows.length > 0), [profile, onlyMine]);
  if (!profile) return null;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <PageHeader icon={KeyRound} tone="slate" eyebrow="Adminisztráció" title="Ki mit tehet?"
                  description="A weboldal jogosultságai rangok és beosztások szerint. A frakció szabályai a Szabályzatok között vannak."
                  actions={<Link to="/policies" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"><ScrollText className="size-4"/> Szabályzatok</Link>}/>
      <label className="inline-flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
        <Switch checked={onlyMine} onCheckedChange={setOnlyMine}/>
        <span className="text-sm text-slate-200">Csak amit én megtehetek</span>
      </label>
      <div className="panel overflow-x-auto p-0" data-tour="permissions-matrix">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0b1324]/95 text-[11px] text-slate-400 backdrop-blur">
              <th className="sticky left-0 z-10 w-[300px] border-b border-white/10 bg-[#0b1324]/95 px-4 py-3 text-left font-semibold">Művelet</th>
              <th className="border-b border-white/10 bg-primary/[0.08] px-2 py-3 text-center font-semibold text-primary">
                <User className="mx-auto mb-0.5 size-3.5"/>Te
              </th>
              {MATRIX_ROLES.map((role) => (
                <th key={role.key} className="border-b border-white/10 px-2 py-3 text-center font-semibold" title={role.hint}>
                  <span className="block text-slate-200">{role.label}</span>
                  <span className="block text-[10px] font-normal text-slate-500">{role.hint}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.title}>
                <tr>
                  <td colSpan={MATRIX_ROLES.length + 2} className="sticky left-0 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                    {group.title}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="group">
                    <td className="sticky left-0 z-[1] border-b border-white/[0.04] bg-[#0a1120]/95 px-4 py-2.5 backdrop-blur group-hover:bg-[#0e172a]">
                      <span className="block text-slate-100">{row.label}</span>
                      {row.hint && <span className="block text-[11px] text-slate-500">{row.hint}</span>}
                    </td>
                    <td className="border-b border-white/[0.04] bg-primary/[0.05] px-2 py-2.5 text-center"><Cell value={row.mine} mine/></td>
                    {row.values.map((value, index) => (
                      <td key={MATRIX_ROLES[index].key} className="border-b border-white/[0.04] px-2 py-2.5 text-center group-hover:bg-white/[0.02]">
                        <Cell value={value}/>
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11px] text-slate-500">
        A táblázat ugyanazokból a szabályokból készül, amelyekkel az oldal dönt; az adatbázis minden műveletnél újra ellenőrzi őket.
      </p>
    </div>
  );
}
