-- Dates in Hungarian time.
--
-- The database keeps UTC (Supabase's recommendation), but "today", "this month" and dates
-- printed into notifications belong to Hungary: with the UTC clock a leave starting today,
-- a registration expiring today or a sheet handed in after midnight counted for the
-- previous day until 01:00 (02:00 in summer). Functions that work with calendar dates run
-- in Europe/Budapest instead (current_date, date_trunc, to_char and ::date follow the
-- function's time zone; timestamps in their JSON output carry the +01:00/+02:00 offset).
--
-- A later `create or replace` of one of these functions must repeat
-- `set timezone = 'Europe/Budapest'`, otherwise it falls back to UTC.

alter function private.convert_vehicle_warnings(uuid, uuid) set timezone = 'Europe/Budapest';
alter function private.exam_block(public.exams, uuid) set timezone = 'Europe/Budapest';
alter function private.on_budget_request_change() set timezone = 'Europe/Budapest';
alter function private.on_former_member_insert() set timezone = 'Europe/Budapest';
alter function private.on_hr_record_change() set timezone = 'Europe/Budapest';
alter function public.fleet_registration_apply(uuid, date, text, text) set timezone = 'Europe/Budapest';
alter function public.fleet_registration_decide(uuid, boolean, date, text, boolean) set timezone = 'Europe/Budapest';
alter function public.fleet_registration_submit(uuid, text, text, text, text, date, date, text) set timezone = 'Europe/Budapest';
alter function public.fleet_renew_registration(uuid, date) set timezone = 'Europe/Budapest';
alter function public.fleet_send_reminders() set timezone = 'Europe/Budapest';
alter function public.generate_case_number() set timezone = 'Europe/Budapest';
alter function public.get_active_leaves() set timezone = 'Europe/Budapest';
alter function public.get_dashboard_summary() set timezone = 'Europe/Budapest';
alter function public.get_hr_registry(date, uuid) set timezone = 'Europe/Budapest';

-- The day a member left defaults to today in Hungary.
alter table public.former_members alter column left_on set default ((now() at time zone 'Europe/Budapest')::date);
