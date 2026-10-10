-- =============================================================================
-- After the frontend of 20261010154417_reports_on_site is deployed (move this file into
-- supabase/migrations/ and push it then). Until that deploy the old frontend still writes
-- report_logs directly (the "Feltöltötted a fórumra?" box, Jelentéseim, Havi összesítő); the new one
-- writes only through save_report, set_report_link, delete_report, void_report and restore_report,
-- which check the author, the payroll lock and the fields.
-- =============================================================================

drop policy if exists report_logs_insert on public.report_logs;
drop policy if exists report_logs_update on public.report_logs;
drop policy if exists report_logs_delete on public.report_logs;
revoke insert, update, delete on public.report_logs from authenticated;
