import {supabase} from "./supabaseClient";
import type {PayrollRow} from "@/types/finance";

/**
 * Printable documents with signatures: a closed month's payslip (signed by whoever closed the
 * month and by the member) and the certificate of a ribbon or a commendation (signed by the
 * issuer and the department head). One call each (get_payslip_document, get_award_document).
 */

export interface DocumentPerson {
  id: string;
  full_name: string;
  faction_rank: string;
  badge_number: string;
}

export interface PayslipDocument {
  month: string;
  row: PayrollRow;
  paid: boolean;
  paid_at: string | null;
  closed_at: string | null;
  closed_by: DocumentPerson | null;
  member: DocumentPerson;
  tax_percent: number | null;
}

export type AwardKind = "ribbon" | "commendation";

export interface AwardDocument {
  kind: AwardKind;
  id: string;
  number: string;
  title: string;
  text: string | null;
  color: string | null;
  image_url: string | null;
  date: string;
  member: DocumentPerson & {division: string | null};
  issuer: DocumentPerson | null;
  head: (DocumentPerson & {title: string}) | null;
}

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

export const documentsApi = {
  payslip: (month: string, userId?: string | null) =>
    rpc<PayslipDocument | null>("get_payslip_document", {_month: `${month.slice(0, 7)}-01`, _user: userId ?? null}),
  award: (kind: AwardKind, id: string) => rpc<AwardDocument | null>("get_award_document", {_kind: kind, _id: id}),
};

/** Where a payslip is printed ("2026-09"; the leadership may add another member). */
export const payslipHref = (month: string, userId?: string | null) =>
  `/finance/payslip/${month.slice(0, 7)}${userId ? `?user=${userId}` : ""}`;

/** Where an award certificate is printed. */
export const awardHref = (kind: AwardKind, id: string) => `/hr/award/${kind}/${id}`;
