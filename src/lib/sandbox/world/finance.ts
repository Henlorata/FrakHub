import {FACTION_RANKS, isExecutive} from "@shared/ranks";
import {computePayroll, inputFromRow} from "@/lib/payroll";
import type {PayrollInput, PayrollRow, PayrollSettings} from "@/types/finance";
import type {Row} from "../postgrest";
import {DAY, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

const SETTINGS: PayrollSettings = {
  rank_pay: {
    "Commander": 15000000, "Deputy Commander": 15000000, "Captain III.": 14000000, "Captain II.": 14000000, "Captain I.": 14000000,
    "Lieutenant II.": 14000000, "Lieutenant I.": 14000000, "Sergeant II.": 13000000, "Sergeant I.": 13000000, "Corporal": 12000000,
    "Staff Deputy Sheriff": 10000000, "Senior Deputy Sheriff": 10000000, "Deputy Sheriff III+.": 9000000, "Deputy Sheriff III.": 8000000,
    "Deputy Sheriff II.": 7000000, "Deputy Sheriff I.": 6000000, "Deputy Sheriff Trainee": 5000000,
  },
  unit_pay: {BM: 3000000, SEB: 500000, MCB: 500000, TSB: 0, SAHP: 450000, GW: 400000, AB: 400000, FAB: 400000, TB: 500000, MU: 400000, SIB: 0},
  duty_tiers: [30, 40, 50, 60, 70, 80, 90, 100].map((hours) => ({hours, pay: hours * 100000})),
  min_duty_hours: 30,
  min_reports: 8,
  top_duty_pay: [6000000, 5000000, 4000000],
  top_report_pay: [6000000, 5000000, 4000000],
  report_pay: 500000,
  picture_pay: 0,
  training_pay: 1000000,
  tax_percent: 3,
  executive_unit: "BM",
};

interface MonthState {
  status: "open" | "closed";
  inputs: Record<string, PayrollInput>;
  paid: Record<string, string>;
  withdrawn: number | null;
  balance: number | null;
  balanceAt: string | null;
  note: string | null;
  closedAt: string | null;
  /** Rows frozen at closing. */
  snapshot: PayrollRow[] | null;
}

const months = new WeakMap<World, Record<string, MonthState>>();

export function seedFinance(world: World) {
  const {tables, me, ago} = world;
  tables.payroll_settings = [{id: "global", ...SETTINGS, updated_at: ago(20 * DAY), updated_by: person(1)}];

  const request = (userId: string, amount: number, reason: string, status: string, minutesAgo: number, extra: Row = {}): Row => ({
    id: world.id(), user_id: userId, amount, reason, proof_image_path: [], status, admin_comment: null, processed_by: status === "pending" ? null : person(2),
    created_at: ago(minutesAgo), updated_at: ago(minutesAgo / 2), proofs_removed_at: null, ...extra,
  });
  tables.budget_requests = [
    request(person(9), 4500, "Szolgálati jármű javítása üldözés után (lökhárító, fényszóró).", "pending", 80),
    request(person(6), 1200, "Üzemanyag a megfigyeléshez (két tankolás).", "pending", 7 * 60),
    request(me.id, 2500, "Elsősegélycsomag pótlása a járőrautóban.", "pending", 20 * 60),
    request(me.id, 4500, "Javítási költség a kikötői ütközés után.", "approved", 6 * DAY),
    request(person(11), 15000, "Új napszemüveg.", "rejected", 9 * DAY, {admin_comment: "Nem szolgálati kiadás."}),
  ];

  const state: Record<string, MonthState> = {};
  const base = (): MonthState => ({status: "open", inputs: {}, paid: {}, withdrawn: null, balance: null, balanceAt: null, note: null, closedAt: null, snapshot: null});
  state[world.month()] = {...base(), balance: 412_500_000, balanceAt: ago(2 * DAY)};
  const previous = world.month(-1);
  state[previous] = base();
  months.set(world, state);
  // Last month is closed and paid out (members see it as their payslip).
  const rows = payrollRows(world, previous);
  state[previous] = {
    ...state[previous], status: "closed", snapshot: rows, withdrawn: rows.reduce((sum, row) => sum + row.total, 0) + 2_000_000,
    paid: Object.fromEntries(rows.filter((row) => row.total > 0).map((row) => [row.user_id, ago(25 * DAY)])), closedAt: ago(25 * DAY),
    balance: 398_000_000, balanceAt: ago(26 * DAY), note: "Gyakorló mód: bemutató hónap.",
  };
}

const monthState = (world: World, month: string) => {
  const state = months.get(world)!;
  return (state[month] ??= {status: "open", inputs: {}, paid: {}, withdrawn: null, balance: null, balanceAt: null, note: null, closedAt: null,
    snapshot: null});
};

const settingsOf = (world: World) => world.tables.payroll_settings?.[0] as unknown as PayrollSettings;

function payrollRows(world: World, month: string): PayrollRow[] {
  const state = monthState(world, month);
  if (state.snapshot) return state.snapshot.map((row) => ({...row, paid: !!state.paid[row.user_id], paid_at: state.paid[row.user_id] ?? null}));
  const accounts = new Map((world.tables.member_bank_accounts ?? []).map((row) => [row.user_id, row.account_number as string]));
  const reports = (world.tables.report_logs ?? []).filter((row) => String(row.month) === month);
  const base: PayrollRow[] = (world.tables.profiles ?? []).filter((row) => row.system_role !== "pending").map((row) => {
    const minutes = Number((world.tables.duty_time_entries ?? []).find((entry) => entry.user_id === row.id && String(entry.month) === month)?.minutes ?? 0);
    const logged = reports.filter((entry) => entry.user_id === row.id).length;
    return {
      user_id: row.id as string, name: row.full_name as string, badge_number: row.badge_number as string, rank: row.faction_rank as string,
      rank_order: (FACTION_RANKS as readonly string[]).indexOf(row.faction_rank as string), division: row.division as string,
      qualifications: (row.qualifications as string[] | null) ?? [], avatar_url: (row.avatar_url as string | null) ?? null,
      account_number: accounts.get(row.id as string) ?? null, eligible: true, eligible_auto: true, duty_minutes: minutes, hours: 0, reports: logged,
      reports_logged: logged, reports_auto: true, pictures: 0, trained: 0, top_duty: 0, top_duty_auto: true, top_report: 0, top_report_auto: true,
      unit: null, unit_auto: true, qualification: null, qualification_auto: true, bonus: 0, bonus_note: null,
      pay: {rank: 0, duty: 0, unit: 0, qualification: 0, reports: 0, pictures: 0, training: 0, top_duty: 0, top_report: 0, bonus: 0},
      total: 0, paid: false, paid_at: null,
    };
  });
  return computePayroll(base, state.inputs, settingsOf(world))
    .map((row) => ({...row, paid: !!state.paid[row.user_id], paid_at: state.paid[row.user_id] ?? null}));
}

function payrollMonth(world: World, month: string) {
  const state = monthState(world, month);
  const rows = payrollRows(world, month).sort((a, b) => a.rank_order - b.rank_order || a.badge_number.localeCompare(b.badge_number));
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const settings = settingsOf(world);
  const all = months.get(world)!;
  return {
    month, status: state.status, saved: Object.keys(state.inputs).length > 0 || state.status === "closed", withdrawn: state.withdrawn,
    balance: state.balance, balance_at: state.balanceAt, balance_by_name: state.balance === null ? null : "Teszt Elek", note: state.note,
    closed_at: state.closedAt, closed_by_name: state.closedAt ? "Teszt Elek" : null, settings, rows, total,
    tax: Math.round(total * settings.tax_percent / 100), paid_total: rows.filter((row) => row.paid).reduce((sum, row) => sum + row.total, 0),
    can_edit_settings: world.me.faction_rank === "Commander" || !!world.me.is_bureau_manager,
    months: Object.keys(all).sort().reverse().map((key) => ({month: key, status: all[key].status})),
  };
}

const requireLeadership = (world: World) => {
  if (!isExecutive(world.me) && !world.me.is_bureau_manager) throw new SandboxError("Ehhez nincs jogosultságod.", "42501");
};

export const financeRpc: Record<string, RpcHandler> = {
  get_payroll: (args, world) => {
    requireLeadership(world);
    return payrollMonth(world, String(args._month ?? world.month()));
  },
  save_payroll_entries: (args, world) => {
    const month = String(args._month);
    const state = monthState(world, month);
    if (state.status === "closed") throw new SandboxError("A lezárt hónap nem módosítható.");
    const current = new Map(payrollRows(world, month).map((row) => [row.user_id, row]));
    for (const [userId, changes] of Object.entries((args._entries ?? {}) as Record<string, Partial<PayrollInput>>)) {
      const row = current.get(userId);
      if (!row) continue;
      state.inputs[userId] = {...(state.inputs[userId] ?? inputFromRow(row)), ...changes};
      if (changes.duty_minutes !== undefined) {
        const entries = (world.tables.duty_time_entries ??= []);
        const entry = entries.find((item) => item.user_id === userId && String(item.month) === month);
        if (entry) entry.minutes = changes.duty_minutes;
        else entries.push({user_id: userId, month, minutes: changes.duty_minutes, updated_at: world.stamp(), updated_by: world.me.id});
      }
    }
    return payrollMonth(world, month);
  },
  set_payroll_paid: (args, world) => {
    const month = String(args._month);
    const state = monthState(world, month);
    for (const id of (args._user_ids ?? []) as string[]) {
      if (args._paid) state.paid[id] = world.stamp();
      else delete state.paid[id];
    }
    return payrollMonth(world, month);
  },
  close_payroll: (args, world) => {
    const month = String(args._month);
    const state = monthState(world, month);
    state.snapshot = payrollRows(world, month);
    Object.assign(state, {status: "closed", withdrawn: args._withdrawn ?? null, note: args._note ?? null, closedAt: world.stamp()});
    return payrollMonth(world, month);
  },
  reopen_payroll: (args, world) => {
    const month = String(args._month);
    Object.assign(monthState(world, month), {status: "open", snapshot: null, closedAt: null});
    return payrollMonth(world, month);
  },
  set_payroll_balance: (args, world) => {
    const month = String(args._month);
    Object.assign(monthState(world, month), {balance: args._balance ?? null, balanceAt: args._balance === null ? null : world.stamp()});
    return payrollMonth(world, month);
  },
  save_payroll_settings: (args, world) => {
    const row = world.tables.payroll_settings![0];
    Object.assign(row, args._settings as Row, {updated_at: world.stamp(), updated_by: world.me.id});
    return row;
  },
  get_my_payslips: (_args, world) => {
    const all = months.get(world)!;
    return Object.keys(all).filter((month) => all[month].status === "closed").sort().reverse().flatMap((month) => {
      const row = payrollRows(world, month).find((item) => item.user_id === world.me.id);
      return row ? [{month, row, paid: row.paid, paid_at: row.paid_at}] : [];
    });
  },
  get_finance_overview: (args, world) => {
    const count = Number(args._months ?? 6);
    const requests = world.tables.budget_requests ?? [];
    const pending = requests.filter((row) => row.status === "pending");
    const all = months.get(world)!;
    const current = world.month();
    return {
      pending: {count: pending.length, amount: pending.reduce((sum, row) => sum + Number(row.amount), 0)},
      current: {month: current, status: all[current]?.status ?? "open",
        estimate: all[current]?.status === "closed" ? null : payrollMonth(world, current).total, tax_percent: 3},
      months: Array.from({length: count}, (_, index) => world.month(index - count + 1)).reverse().map((month, index) => {
        const state = all[month];
        const total = state ? payrollMonth(world, month).total : null;
        return {
          month, reimbursed: [4500, 12800, 9600, 15200, 7300, 11000][index] ?? 0, reimbursements: [1, 4, 3, 5, 2, 4][index] ?? 0,
          payroll_status: state?.status ?? (index > 1 ? "closed" : null), payroll_total: total ?? (index > 1 ? 180_000_000 + index * 7_500_000 : null),
          payroll_withdrawn: state?.withdrawn ?? (index > 1 ? 185_000_000 + index * 7_500_000 : null), payroll_tax_percent: 3,
          balance: state?.balance ?? [null, null, 384_000_000, 371_000_000, 352_000_000, 330_000_000][index] ?? null,
          balance_at: state?.balanceAt ?? (index > 1 ? world.ago(index * 30 * 24 * 60) : null),
        };
      }),
    };
  },
  decide_budget_request: (args, world) => {
    const row = (world.tables.budget_requests ?? []).find((item) => item.id === args._request_id);
    if (!row) throw new SandboxError("A kérelem nem található.");
    Object.assign(row, {status: args._approve ? "approved" : "rejected", admin_comment: args._comment ?? null, processed_by: world.me.id,
      updated_at: world.stamp()});
    return {id: row.id, status: row.status};
  },
};
