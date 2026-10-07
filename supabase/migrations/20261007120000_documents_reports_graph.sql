-- =============================================================================
-- Housekeeping, printable payslips and award certificates, reports from the public page, and the
-- MCB's relationship graph.
--
-- 1. Housekeeping: one run_housekeeping() call for the daily cron (old read notifications, the
--    calculator's log after 400 days instead of one day, so the statistics have their year, closed
--    vehicle requests after 120 days for the fleet's 90-day view, closed BOLOs after a year, the
--    public form's rate-limit rows), and a daily size reading for the leadership (db_health).
-- 2. get_payslip_document(): a closed month's payslip with who closed it (the signer).
-- 3. get_award_document(): a ribbon or a commendation as a certificate (issuer + department head).
-- 4. Public reports: visitors write to the IAB (complaint), the MCB (tip) or the Command Staff
--    (question) from the public page. No e-mail anywhere: the report becomes a mail thread, the
--    visitor gets a tracking code and reads the answers the staff mark for them on the public page.
-- 5. get_relationship_graph(): persons, organisations, cases, vehicles (by plate) and addresses
--    around one of them, for the MCB's relationship graph; search_graph_nodes() finds a start.
--
-- Compatible with the deployed frontend: new functions, nullable columns, a wider check, and
-- send_mail() (only the new frontend calls it) gets one more optional parameter.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Housekeeping
-- ---------------------------------------------------------------------------

-- Rate limit of the public form (salted hashes of the sender's address, kept two days).
create table if not exists private.public_report_limits (
  ip_hash text not null,
  action text not null check (action in ('submit', 'reply')),
  created_at timestamptz not null default now()
);
create index if not exists public_report_limits_idx on private.public_report_limits (ip_hash, action, created_at);
revoke all on private.public_report_limits from public, anon, authenticated;

create or replace function public.run_housekeeping()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _read integer;
  _old integer;
  _actions integer;
  _requests integer;
  _bolos integer;
  _limits integer;
  _health json;
begin
  -- Notifications: read ones after a month, everything after four months.
  delete from public.notifications where is_read and created_at < now() - interval '30 days';
  get diagnostics _read = row_count;
  delete from public.notifications where created_at < now() - interval '120 days';
  get diagnostics _old = row_count;
  -- The calculator's log feeds the department statistics (up to a year back).
  delete from public.action_logs where created_at < now() - interval '400 days';
  get diagnostics _actions = row_count;
  -- Decided vehicle requests: the fleet's utilisation view looks 90 days back.
  delete from public.vehicle_requests where status <> 'pending' and created_at < now() - interval '120 days';
  get diagnostics _requests = row_count;
  -- BOLO alerts closed or lapsed more than a year ago.
  delete from public.bolo_alerts
  where (status <> 'active' or expires_at < now()) and coalesce(resolved_at, expires_at) < now() - interval '365 days';
  get diagnostics _bolos = row_count;
  delete from private.public_report_limits where created_at < now() - interval '2 days';
  get diagnostics _limits = row_count;

  -- The size of the database against the free plan's 500 MB, for the leadership's dashboard.
  _health := json_build_object(
    'bytes', pg_database_size(current_database()),
    'limit_bytes', 500 * 1024 * 1024,
    'measured_at', now(),
    'largest', (select coalesce(json_agg(json_build_object('table', t.name, 'bytes', t.bytes) order by t.bytes desc), '[]')
                from (select n.nspname || '.' || c.relname as name, pg_total_relation_size(c.oid) as bytes
                      from pg_class c join pg_namespace n on n.oid = c.relnamespace
                      where c.relkind = 'r' and n.nspname in ('public', 'auth', 'storage', 'private')
                      order by pg_total_relation_size(c.oid) desc limit 5) t));
  insert into private.app_state (key, value, updated_at) values ('db_health', _health::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

  return json_build_object('notifications_read', _read, 'notifications_old', _old, 'action_logs', _actions,
                           'vehicle_requests', _requests, 'bolos', _bolos, 'rate_limits', _limits, 'health', _health);
end;
$$;
revoke execute on function public.run_housekeeping() from public, anon, authenticated;
grant execute on function public.run_housekeeping() to service_role;

-- The last reading for the statistics page (Executive Staff, Bureau Manager).
create or replace function public.get_db_health()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_executive_or_manager() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return (select a.value::json from private.app_state a where a.key = 'db_health');
end;
$$;
revoke execute on function public.get_db_health() from public, anon, authenticated;
grant execute on function public.get_db_health() to authenticated;

-- The dashboard summary carries the reading for the Executive Staff and the Bureau Manager (every key kept).
do $do$
declare
  _def text := pg_get_functiondef('public.get_dashboard_summary()'::regprocedure);
  _anchor text := $$(select count(*) from iab_cases c where c.status = 'open' and private.can_view_iab_case(c.id)) end$$;
begin
  if position('''db_health''' in _def) = 0 then
    if position(_anchor in _def) = 0 then raise exception 'get_dashboard_summary: the anchor for db_health was not found'; end if;
    _def := replace(_def, _anchor, _anchor || $$,
    -- The database's size against the free plan (measured by the daily housekeeping), for the leadership.
    'db_health', case when private.is_executive_or_manager() then
      (select a.value::json from private.app_state a where a.key = 'db_health') end$$);
    execute _def;
  end if;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 2. Payslips to print
-- ---------------------------------------------------------------------------

-- A closed month's payslip: the member's own, or anyone's for the leadership who pays.
create or replace function public.get_payslip_document(_month date, _user uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _uid uuid := coalesce(_user, (select auth.uid()));
  _run public.payroll_runs;
  _entry public.payroll_entries;
begin
  if _me is null or not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if _uid <> _me and not private.is_executive_or_manager() then
    raise exception 'Más fizetési papírját a vezetőség nyomtathatja.' using errcode = '42501';
  end if;
  select * into _run from public.payroll_runs where month = date_trunc('month', _month)::date and status = 'closed';
  if _run.month is null then return null; end if;
  select * into _entry from public.payroll_entries where month = _run.month and user_id = _uid and snapshot is not null;
  if _entry.id is null then return null; end if;
  return json_build_object(
    'month', _run.month, 'row', _entry.snapshot, 'paid', _entry.paid, 'paid_at', _entry.paid_at,
    'closed_at', _run.closed_at, 'closed_by', private.person_json(_run.closed_by),
    'member', private.person_json(_uid), 'tax_percent', _run.settings -> 'tax_percent');
end;
$$;
revoke execute on function public.get_payslip_document(date, uuid) from public, anon, authenticated;
grant execute on function public.get_payslip_document(date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Award certificates
-- ---------------------------------------------------------------------------

-- The department head as a signer: name, rank and the title under the signature.
create or replace function private.head_json()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('id', p.id, 'full_name', p.full_name, 'faction_rank', p.faction_rank, 'badge_number', p.badge_number,
                           'title', case when p.is_bureau_manager then 'Bureau Manager' else p.faction_rank end)
  from public.profiles p where p.id = private.department_head();
$$;
revoke execute on function private.head_json() from public, anon, authenticated;

-- A ribbon (user_ribbons) or a commendation (hr_records) as a certificate: for the member and the staff.
create or replace function public.get_award_document(_kind text, _id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _member uuid;
  _issuer uuid;
  _date timestamptz;
  _title text;
  _text text;
  _color text;
  _image text;
begin
  if _me is null or not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if _kind = 'ribbon' then
    select ur.user_id, ur.awarded_by, coalesce(ur.awarded_at, now()), r.name, r.description, r.color_hex, r.image_url
    into _member, _issuer, _date, _title, _text, _color, _image
    from public.user_ribbons ur join public.ribbons r on r.id = ur.ribbon_id where ur.id = _id;
  elsif _kind = 'commendation' then
    select h.user_id, h.created_by, h.created_at, h.title, h.details
    into _member, _issuer, _date, _title, _text
    from public.hr_records h where h.id = _id and h.kind = 'commendation' and h.status = 'active';
  else
    raise exception 'Ismeretlen irat.';
  end if;
  if _member is null then return null; end if;
  if _member <> _me and not private.is_staff() then raise exception 'Ezt az oklevelet csak a tag és a staff nyomtathatja.' using errcode = '42501'; end if;
  return json_build_object(
    'kind', _kind, 'id', _id, 'number', upper(left(replace(_id::text, '-', ''), 8)),
    'title', _title, 'text', _text, 'color', _color, 'image_url', _image, 'date', _date,
    'member', (select json_build_object('id', p.id, 'full_name', p.full_name, 'faction_rank', p.faction_rank, 'badge_number', p.badge_number,
                                        'division', p.division) from public.profiles p where p.id = _member),
    'issuer', private.person_json(_issuer),
    'head', private.head_json());
end;
$$;
revoke execute on function public.get_award_document(text, uuid) from public, anon, authenticated;
grant execute on function public.get_award_document(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reports from the public page (no e-mail: a tracking code)
-- ---------------------------------------------------------------------------

alter table public.mail_threads
  add column if not exists public_ref text unique,
  add column if not exists public_secret text,
  add column if not exists public_kind text check (public_kind in ('complaint', 'tip', 'question')),
  add column if not exists public_status text check (public_status in ('open', 'closed')),
  add column if not exists public_contact text check (char_length(public_contact) <= 80);
alter table public.mail_messages add column if not exists visible_to_reporter boolean not null default false;
alter table public.mail_messages drop constraint if exists mail_messages_sender_kind_check;
alter table public.mail_messages add constraint mail_messages_sender_kind_check
  check (sender_kind in ('self', 'external', 'iab', 'sib', 'command', 'public'));

-- Who reads a shared address. While the IAB has no staff, its mail goes to the Bureau Manager, so a
-- complaint from the public page is never left without a reader.
create or replace function private.mail_group_member(_key text, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = _uid and p.system_role <> 'pending'
      and case _key
        when 'all' then true
        when 'iab' then p.iab_title is not null
          or (coalesce(p.is_bureau_manager, false)
              and not exists (select 1 from public.profiles q where q.iab_title is not null and q.system_role <> 'pending'))
        when 'command' then private.rank_index(p.faction_rank) <= 6 or coalesce(p.is_bureau_manager, false)
        when 'sib' then 'SIB' = any(coalesce(p.qualifications, '{}')) or 'SIB' = any(coalesce(p.commanded_divisions, '{}'))
        when 'mcb' then p.division = 'MCB'
        when 'seb' then p.division = 'SEB'
        when 'tsb' then p.division = 'TSB'
        else false
      end);
$$;

-- A salted hash of the visitor's address (for the rate limit only; the address is never stored).
create or replace function private.visitor_hash()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to(
    (select salt from private.feedback_secret where id = 1) || ':public:' || coalesce(
      nullif(btrim((current_setting('request.headers', true)::json) ->> 'cf-connecting-ip'), ''),
      nullif(btrim(split_part((current_setting('request.headers', true)::json) ->> 'x-forwarded-for', ',', 1)), ''),
      'unknown'), 'UTF8')), 'hex');
$$;
revoke execute on function private.visitor_hash() from public, anon, authenticated;

-- Random characters without look-alikes (0/O, 1/I/L).
create or replace function private.random_code(_length integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  _alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  _bytes bytea := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex');
  _out text := '';
begin
  for _i in 0 .. least(_length, 32) - 1 loop
    _out := _out || substr(_alphabet, get_byte(_bytes, _i) % length(_alphabet) + 1, 1);
  end loop;
  return _out;
end;
$$;
revoke execute on function private.random_code(integer) from public, anon, authenticated;

-- The thread of a tracking code ("SF-XXXX-XXXX-YYYY-YYYY": reference + secret), or null.
create or replace function private.public_report_thread(_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.mail_threads t
  where upper(btrim(coalesce(_code, ''))) ~ '^SF-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$'
    and t.public_ref = left(upper(btrim(_code)), 12)
    and t.public_secret = encode(sha256(convert_to(substr(upper(btrim(_code)), 14), 'UTF8')), 'hex');
$$;
revoke execute on function private.public_report_thread(text) from public, anon, authenticated;

-- Throws when the visitor (or everybody together) sent too much lately.
create or replace function private.public_report_throttle(_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _hash text := private.visitor_hash();
begin
  if (select count(*) from private.public_report_limits l
      where l.ip_hash = _hash and l.action = _action and l.created_at > now() - interval '1 day') >= (case _action when 'submit' then 3 else 15 end) then
    raise exception 'Ma már elég üzenetet küldtél innen; holnap újra próbálhatod.' using errcode = '54000';
  end if;
  if _action = 'submit' and (select count(*) from private.public_report_limits l
                             where l.action = 'submit' and l.created_at > now() - interval '1 day') >= 40 then
    raise exception 'Most túl sok bejelentés érkezett; kérjük, próbáld újra később.' using errcode = '54000';
  end if;
  insert into private.public_report_limits (ip_hash, action) values (_hash, _action);
end;
$$;
revoke execute on function private.public_report_throttle(text) from public, anon, authenticated;

-- A visitor's report: complaint → IAB, tip → MCB, question → Command Staff. Returns the tracking code.
create or replace function public.submit_public_report(
  _kind text, _subject text, _body text, _name text default null, _contact text default null,
  _trap text default null, _elapsed integer default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _group text := case _kind when 'complaint' then 'iab' when 'tip' then 'mcb' when 'question' then 'command' end;
  _ref text;
  _secret text;
  _thread uuid;
  _now timestamptz := clock_timestamp();
  _sender text := coalesce(nullif(btrim(regexp_replace(coalesce(_name, ''), '[[:cntrl:]]', '', 'g')), ''), 'Névtelen bejelentő');
  _clean_subject text := btrim(regexp_replace(coalesce(_subject, ''), '[[:cntrl:]]', ' ', 'g'));
  _clean_body text := btrim(regexp_replace(coalesce(_body, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
begin
  if _group is null then raise exception 'Válaszd ki, kinek szól az üzenet.'; end if;
  -- Bots fill the hidden field and send at once.
  if coalesce(_trap, '') <> '' or (_elapsed is not null and _elapsed < 2500) then
    raise exception 'Az üzenet nem küldhető el. Próbáld újra.' using errcode = '54000';
  end if;
  if char_length(_clean_subject) not between 4 and 120 then raise exception 'A tárgy 4–120 karakter legyen.'; end if;
  if char_length(_clean_body) not between 20 and 4000 then raise exception 'Az üzenet 20–4000 karakter legyen.'; end if;
  if char_length(_sender) > 80 or char_length(coalesce(_contact, '')) > 80 then raise exception 'A név és az elérhetőség legfeljebb 80 karakter.'; end if;
  perform private.public_report_throttle('submit');

  loop
    _ref := 'SF-' || private.random_code(4) || '-' || private.random_code(4);
    exit when not exists (select 1 from public.mail_threads t where t.public_ref = _ref);
  end loop;
  _secret := private.random_code(4) || '-' || private.random_code(4);

  insert into public.mail_threads (subject, created_by, created_at, last_message_at, message_count,
                                   public_ref, public_secret, public_kind, public_status, public_contact)
  values (left(_clean_subject, 200), null, _now, _now, 1, _ref, encode(sha256(convert_to(_secret, 'UTF8')), 'hex'), _kind, 'open',
          nullif(btrim(regexp_replace(coalesce(_contact, ''), '[[:cntrl:]]', '', 'g')), ''))
  returning id into _thread;
  insert into public.mail_recipients (thread_id, group_key, address) values (_thread, _group, private.mail_group_address(_group));
  insert into public.mail_messages (thread_id, author_id, sender_name, sender_address, sender_kind, to_display, body, created_at, visible_to_reporter)
  values (_thread, null, left(_sender, 120), 'nyilvános űrlap', 'public', array[private.mail_group_address(_group)], _clean_body, _now, true);

  perform private.notify(private.mail_readers(_thread),
    left(case _kind when 'complaint' then 'Nyilvános panasz: ' when 'tip' then 'Nyilvános bejelentés: ' else 'Nyilvános kérdés: ' end || _clean_subject, 160),
    left(_sender || ': ' || regexp_replace(_clean_body, '\s+', ' ', 'g'), 300),
    'info', case _kind when 'complaint' then 'iab' else 'mail' end, '/mail?thread=' || _thread, 'mail:' || _thread);
  return json_build_object('code', _ref || '-' || _secret, 'ref', _ref);
end;
$$;
revoke execute on function public.submit_public_report(text, text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.submit_public_report(text, text, text, text, text, text, integer) to anon, authenticated;

-- What the visitor sees with the code: their messages and the answers marked for them.
create or replace function public.get_public_report(_code text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _id uuid := private.public_report_thread(_code);
  _t public.mail_threads;
begin
  if _id is null then return null; end if;
  select * into _t from public.mail_threads where id = _id;
  return json_build_object(
    'ref', _t.public_ref, 'kind', _t.public_kind, 'status', _t.public_status, 'subject', _t.subject, 'created_at', _t.created_at,
    'messages', (select coalesce(json_agg(json_build_object(
                   'id', m.id, 'mine', m.sender_kind = 'public',
                   'from', m.sender_name,
                   'office', m.sender_kind in ('iab', 'sib', 'command'),
                   'body', m.body, 'created_at', m.created_at) order by m.created_at), '[]')
                 from public.mail_messages m where m.thread_id = _id and m.visible_to_reporter));
end;
$$;
revoke execute on function public.get_public_report(text) from public, anon, authenticated;
grant execute on function public.get_public_report(text) to anon, authenticated;

-- The visitor answers (while the report is open).
create or replace function public.reply_public_report(_code text, _body text, _trap text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _id uuid := private.public_report_thread(_code);
  _t public.mail_threads;
  _now timestamptz := clock_timestamp();
  _clean text := btrim(regexp_replace(coalesce(_body, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
  _sender text;
begin
  if _id is null then raise exception 'A követőkód nem érvényes.' using errcode = '42501'; end if;
  if coalesce(_trap, '') <> '' then raise exception 'Az üzenet nem küldhető el.' using errcode = '54000'; end if;
  select * into _t from public.mail_threads where id = _id;
  if _t.public_status = 'closed' then raise exception 'Ezt az ügyet lezárták; új üzenetet új bejelentésként küldhetsz.'; end if;
  if char_length(_clean) not between 2 and 4000 then raise exception 'Az üzenet 2–4000 karakter legyen.'; end if;
  perform private.public_report_throttle('reply');
  select m.sender_name into _sender from public.mail_messages m where m.thread_id = _id and m.sender_kind = 'public' order by m.created_at limit 1;
  insert into public.mail_messages (thread_id, author_id, sender_name, sender_address, sender_kind, to_display, body, created_at, visible_to_reporter)
  values (_id, null, coalesce(_sender, 'Névtelen bejelentő'), 'nyilvános űrlap', 'public',
          (select array_agg(r.address order by r.added_at) from public.mail_recipients r where r.thread_id = _id), _clean, _now, true);
  update public.mail_threads set last_message_at = _now, message_count = message_count + 1 where id = _id;
  perform private.notify(private.mail_readers(_id), left('Válasz a nyilvános bejelentésre: ' || _t.subject, 160),
    left(coalesce(_sender, 'Névtelen bejelentő') || ': ' || regexp_replace(_clean, '\s+', ' ', 'g'), 300),
    'info', case _t.public_kind when 'complaint' then 'iab' else 'mail' end, '/mail?thread=' || _id, 'mail:' || _id);
end;
$$;
revoke execute on function public.reply_public_report(text, text, text) from public, anon, authenticated;
grant execute on function public.reply_public_report(text, text, text) to anon, authenticated;

-- The readers who may answer close or reopen a public report.
create or replace function public.set_public_report_status(_thread uuid, _status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _status not in ('open', 'closed') then raise exception 'Ismeretlen állapot.'; end if;
  if not exists (select 1 from public.mail_threads t where t.id = _thread and t.public_ref is not null) or not private.can_reply_mail(_thread) then
    raise exception 'Ezt a bejelentést nem kezelheted.' using errcode = '42501';
  end if;
  update public.mail_threads set public_status = _status where id = _thread;
end;
$$;
revoke execute on function public.set_public_report_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_public_report_status(uuid, text) to authenticated;

-- The list entry and the thread tell the staff that a thread came from the public page.
create or replace function private.mail_thread_json(_t public.mail_threads, _me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _t.id, 'subject', _t.subject, 'created_at', _t.created_at, 'last_message_at', _t.last_message_at,
    'message_count', _t.message_count, 'broadcast', _t.broadcast,
    'iab', exists (select 1 from public.mail_recipients r where r.thread_id = _t.id and r.group_key = 'iab'),
    'public_kind', _t.public_kind,
    'unread', _t.last_message_at > coalesce((select rd.read_at from public.mail_reads rd where rd.thread_id = _t.id and rd.user_id = _me), '-infinity')
              and exists (select 1 from public.mail_messages m where m.thread_id = _t.id and m.created_at = _t.last_message_at
                          and m.author_id is distinct from _me),
    'last', (select json_build_object('sender_name', m.sender_name, 'sender_address', m.sender_address, 'snippet', left(m.body, 160))
             from public.mail_messages m where m.thread_id = _t.id order by m.created_at desc limit 1),
    'to', (select coalesce(array_agg(r.address order by r.added_at), '{}') from public.mail_recipients r where r.thread_id = _t.id));
$$;

do $do$
declare
  _def text := pg_get_functiondef('public.get_mail_thread(uuid)'::regprocedure);
begin
  if position('''public''' in _def) = 0 then
    _def := replace(_def, $$'can_reply', private.can_reply_mail(_id),$$,
      $$'can_reply', private.can_reply_mail(_id),
    -- Came from the public page: the staff see the reference, the kind and the status (never the secret).
    'public', case when _t.public_ref is not null then
      json_build_object('ref', _t.public_ref, 'kind', _t.public_kind, 'status', _t.public_status, 'contact', _t.public_contact) end,$$);
    _def := replace(_def, $$'to', m.to_display, 'body', m.body, 'created_at', m.created_at,$$,
      $$'to', m.to_display, 'body', m.body, 'created_at', m.created_at, 'visible_to_reporter', m.visible_to_reporter,$$);
    if position('''public''' in _def) = 0 or position('''visible_to_reporter''' in _def) = 0 then
      raise exception 'get_mail_thread: the anchors were not found';
    end if;
    execute _def;
  end if;
end;
$do$;

-- send_mail() with the choice whether the visitor of a public report reads the answer.
drop function if exists public.send_mail(text, text, jsonb, uuid, text, text, text);
create or replace function public.send_mail(
  _subject text, _body text, _to jsonb default '[]'::jsonb, _thread uuid default null,
  _as text default 'self', _external_name text default null, _external_address text default null,
  _to_reporter boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me public.profiles := private.me();
  _thread_id uuid := _thread;
  _new boolean := _thread is null;
  _item jsonb;
  _uid uuid;
  _key text;
  _sender_name text;
  _sender_address text;
  _kind text := coalesce(nullif(_as, ''), 'self');
  _now timestamptz := clock_timestamp();
  _subject_now text;
  _readers uuid[];
  _public boolean := false;
begin
  if _me.id is null then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if length(btrim(coalesce(_body, ''))) = 0 then raise exception 'A levél üres.'; end if;
  if length(_body) > 20000 then raise exception 'A levél legfeljebb 20 000 karakter lehet.'; end if;

  -- The sender.
  if _kind = 'self' then
    _sender_name := _me.full_name;
    _sender_address := private.mail_address(_me.full_name);
  elsif _kind in ('iab', 'sib', 'command') then
    if not private.mail_group_member(_kind, _me.id) then raise exception 'Ennek az irodának a nevében nem írhatsz.' using errcode = '42501'; end if;
    _sender_name := case _kind when 'iab' then 'Internal Affairs Bureau' when 'sib' then 'Sheriff''s Information Bureau' else 'SFSD Command Staff' end;
    _sender_address := private.mail_group_address(_kind);
  elsif _kind = 'external' then
    if not private.can_mail_broadcast() then raise exception 'Külső levelet a vezetőség, az IAB és a SIB rögzíthet.' using errcode = '42501'; end if;
    _sender_name := btrim(coalesce(_external_name, ''));
    _sender_address := lower(btrim(coalesce(_external_address, '')));
    if length(_sender_name) < 2 then raise exception 'Add meg a külső feladó nevét.'; end if;
    if _sender_address !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'A külső feladó címe nem érvényes e-mail cím.'; end if;
    if _sender_address like '%@sfsd.org' then raise exception 'Külső feladó nem lehet @sfsd.org címmel.'; end if;
  else
    raise exception 'Ismeretlen feladó.';
  end if;

  if _new then
    if length(btrim(coalesce(_subject, ''))) = 0 then raise exception 'Adj tárgyat a levélnek.'; end if;
    if jsonb_array_length(coalesce(_to, '[]'::jsonb)) = 0 then raise exception 'Adj meg legalább egy címzettet.'; end if;
    insert into public.mail_threads (subject, created_by, created_at, last_message_at)
    values (left(btrim(_subject), 200), _me.id, _now, _now) returning id into _thread_id;
  else
    if not private.can_reply_mail(_thread_id) then raise exception 'Erre a levélre nem válaszolhatsz.' using errcode = '42501'; end if;
    _public := coalesce(_to_reporter, false) and exists (select 1 from public.mail_threads t where t.id = _thread_id and t.public_ref is not null);
  end if;

  -- Recipients (new ones are added to the thread).
  for _item in select * from jsonb_array_elements(coalesce(_to, '[]'::jsonb)) loop
    if _item ->> 'kind' = 'group' then
      _key := _item ->> 'key';
      if private.mail_group_address(_key) is null then raise exception 'Ismeretlen csoportcím.'; end if;
      if _key = 'all' and not private.can_mail_broadcast() then
        raise exception 'A teljes állománynak a staff, az IAB és a SIB írhat.' using errcode = '42501';
      end if;
      insert into public.mail_recipients (thread_id, group_key, address) values (_thread_id, _key, private.mail_group_address(_key))
      on conflict do nothing;
      if _key = 'all' then update public.mail_threads set broadcast = true where id = _thread_id; end if;
    elsif _item ->> 'kind' = 'user' then
      _uid := private.try_uuid(_item ->> 'id');
      insert into public.mail_recipients (thread_id, user_id, address)
      select _thread_id, p.id, private.mail_address(p.full_name) from public.profiles p where p.id = _uid and p.system_role <> 'pending'
      on conflict do nothing;
    end if;
  end loop;
  if not exists (select 1 from public.mail_recipients r where r.thread_id = _thread_id) then raise exception 'Adj meg legalább egy címzettet.'; end if;

  insert into public.mail_messages (thread_id, author_id, sender_name, sender_address, sender_kind, to_display, body, created_at, visible_to_reporter)
  values (_thread_id, _me.id, _sender_name, _sender_address, _kind,
          (select array_agg(r.address order by r.added_at) from public.mail_recipients r where r.thread_id = _thread_id and r.address <> _sender_address),
          btrim(_body), _now, _public);
  update public.mail_threads set last_message_at = _now, message_count = message_count + 1 where id = _thread_id
  returning subject into _subject_now;
  insert into public.mail_reads (thread_id, user_id, read_at) values (_thread_id, _me.id, _now)
  on conflict (thread_id, user_id) do update set read_at = excluded.read_at;

  _readers := array_remove(private.mail_readers(_thread_id), _me.id);
  perform private.notify(_readers, left(case when _new then 'Új levél: ' else 'Válasz: ' end || _subject_now, 160),
    left(_sender_name || ' <' || _sender_address || '>: ' || regexp_replace(btrim(_body), '\s+', ' ', 'g'), 300),
    'info', 'mail', '/mail?thread=' || _thread_id, 'mail:' || _thread_id);
  return _thread_id;
end;
$$;
revoke execute on function public.send_mail(text, text, jsonb, uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.send_mail(text, text, jsonb, uuid, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The relationship graph (MCB)
-- ---------------------------------------------------------------------------

-- Node keys: person:<id>, org:<id>, case:<id>, plate:<plate key>, address:<lower-case address>.
-- Vehicles meet by plate and properties by address, so two persons with the same car or house are linked.
create or replace function private.graph_neighbors(_key text)
returns table (target text, label text)
language sql
stable
security definer
set search_path = ''
as $$
  with k as (select split_part(_key, ':', 1) as kind, substr(_key, strpos(_key, ':') + 1) as ref)
  select 'person:' || case when a.suspect_id::text = k.ref then a.associate_id else a.suspect_id end, a.relationship
  from k join public.suspect_associates a on k.kind = 'person' and (a.suspect_id::text = k.ref or a.associate_id::text = k.ref)
  where a.suspect_id is not null and a.associate_id is not null
  union all
  select 'org:' || m.organization_id, m.role
  from k join public.organization_members m on k.kind = 'person' and m.suspect_id::text = k.ref
  union all
  select 'plate:' || private.plate_key(v.plate_number), v.vehicle_type
  from k join public.suspect_vehicles v on k.kind = 'person' and v.suspect_id::text = k.ref
  where private.plate_key(v.plate_number) <> ''
  union all
  select 'address:' || lower(btrim(p.address)), p.property_type
  from k join public.suspect_properties p on k.kind = 'person' and p.suspect_id::text = k.ref
  where btrim(p.address) <> ''
  union all
  select 'case:' || cs.case_id, cs.involvement_type
  from k join public.case_suspects cs on k.kind = 'person' and cs.suspect_id::text = k.ref
  where cs.case_id is not null
  union all
  select 'person:' || m.suspect_id, m.role
  from k join public.organization_members m on k.kind = 'org' and m.organization_id::text = k.ref
  union all
  select 'person:' || cs.suspect_id, cs.involvement_type
  from k join public.case_suspects cs on k.kind = 'case' and cs.case_id::text = k.ref
  where cs.suspect_id is not null
  union all
  select 'person:' || v.suspect_id, v.vehicle_type
  from k join public.suspect_vehicles v on k.kind = 'plate' and private.plate_key(v.plate_number) = k.ref
  where v.suspect_id is not null
  union all
  select 'person:' || p.suspect_id, p.property_type
  from k join public.suspect_properties p on k.kind = 'address' and lower(btrim(p.address)) = k.ref
  where p.suspect_id is not null
$$;
revoke execute on function private.graph_neighbors(text) from public, anon, authenticated;

create or replace function private.graph_node(_key text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _kind text := split_part(_key, ':', 1);
  _ref text := substr(_key, strpos(_key, ':') + 1);
begin
  return case _kind
    when 'person' then (select json_build_object('key', _key, 'kind', 'person', 'id', s.id, 'label', s.full_name, 'alias', s.alias,
                                                 'status', s.status, 'image', s.mugshot_url)
                        from public.suspects s where s.id = private.try_uuid(_ref))
    when 'org' then (select json_build_object('key', _key, 'kind', 'org', 'id', o.id, 'label', o.name, 'color', o.color, 'image', o.logo_url,
                                              'status', o.status, 'threat', o.threat)
                     from public.crime_organizations o where o.id = private.try_uuid(_ref))
    when 'case' then (select json_build_object('key', _key, 'kind', 'case', 'id', c.id, 'label', c.case_number, 'title', c.title,
                                               'status', c.status, 'can_open', private.can_view_case_details(c.id))
                      from public.cases c where c.id = private.try_uuid(_ref))
    when 'plate' then (select json_build_object('key', _key, 'kind', 'plate', 'label', upper(btrim(v.plate_number)),
                                                'title', concat_ws(' · ', v.vehicle_type, v.color))
                       from public.suspect_vehicles v where private.plate_key(v.plate_number) = _ref order by v.created_at limit 1)
    when 'address' then (select json_build_object('key', _key, 'kind', 'address', 'label', btrim(p.address), 'title', p.property_type)
                         from public.suspect_properties p where lower(btrim(p.address)) = _ref order by p.created_at limit 1)
  end;
end;
$$;
revoke execute on function private.graph_node(text) from public, anon, authenticated;

-- The graph around one node, up to _depth steps (at most 150 nodes).
create or replace function public.get_relationship_graph(_key text, _depth integer default 2)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _max constant integer := 150;
  _seen text[];
  _frontier text[];
  _next text[];
  _edges text[] := '{}';
  _node text;
  _step integer;
  _row record;
  _pair text;
  _truncated boolean := false;
begin
  if not private.can_view_cases() then raise exception 'A kapcsolati hálót az MCB és a staff látja.' using errcode = '42501'; end if;
  if _key is null or _key !~ '^(person|org|case|plate|address):.+' or private.graph_node(_key) is null then return null; end if;
  _seen := array[_key];
  _frontier := array[_key];
  for _step in 1 .. least(greatest(coalesce(_depth, 2), 1), 3) loop
    _next := '{}';
    foreach _node in array _frontier loop
      for _row in select distinct n.target, n.label from private.graph_neighbors(_node) n where n.target is not null loop
        if not _row.target = any(_seen) then
          if cardinality(_seen) >= _max then
            _truncated := true;
            continue;
          end if;
          _seen := _seen || _row.target;
          _next := _next || _row.target;
        end if;
        _pair := least(_node, _row.target) || '|' || greatest(_node, _row.target) || '|' || replace(coalesce(_row.label, ''), '|', '/');
        if not _pair = any(_edges) then _edges := _edges || _pair; end if;
      end loop;
    end loop;
    exit when cardinality(_next) = 0;
    _frontier := _next;
  end loop;

  return json_build_object(
    'center', _key,
    'truncated', _truncated,
    'nodes', (select coalesce(json_agg(n.node), '[]') from (select private.graph_node(k) as node from unnest(_seen) k) n where n.node is not null),
    'edges', (select coalesce(json_agg(json_build_object('source', split_part(e, '|', 1), 'target', split_part(e, '|', 2),
                                                         'label', nullif(split_part(e, '|', 3), ''))), '[]')
              from unnest(_edges) e
              where split_part(e, '|', 1) = any(_seen) and split_part(e, '|', 2) = any(_seen)));
end;
$$;
revoke execute on function public.get_relationship_graph(text, integer) from public, anon, authenticated;
grant execute on function public.get_relationship_graph(text, integer) to authenticated;

-- A start for the graph: persons, organisations, cases, plates and addresses matching the text.
create or replace function public.search_graph_nodes(_query text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _q text := btrim(coalesce(_query, ''));
  _like text;
begin
  if not private.can_view_cases() then raise exception 'A kapcsolati hálót az MCB és a staff látja.' using errcode = '42501'; end if;
  if char_length(_q) < 2 then return '[]'::json; end if;
  _like := '%' || replace(replace(replace(_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return (select coalesce(json_agg(x.item), '[]') from (
    (select json_build_object('key', 'person:' || s.id, 'kind', 'person', 'label', s.full_name, 'title', s.alias) as item
     from public.suspects s where s.full_name ilike _like or s.alias ilike _like order by s.full_name limit 8)
    union all
    (select json_build_object('key', 'org:' || o.id, 'kind', 'org', 'label', o.name, 'title', o.territory)
     from public.crime_organizations o where o.name ilike _like order by o.name limit 5)
    union all
    (select json_build_object('key', 'case:' || c.id, 'kind', 'case', 'label', c.case_number, 'title', c.title)
     from public.cases c where c.case_number ilike _like or c.title ilike _like order by c.updated_at desc limit 5)
    union all
    (select distinct on (private.plate_key(v.plate_number))
            json_build_object('key', 'plate:' || private.plate_key(v.plate_number), 'kind', 'plate', 'label', upper(btrim(v.plate_number)),
                              'title', v.vehicle_type)
     from public.suspect_vehicles v
     where private.plate_key(v.plate_number) like '%' || private.plate_key(_q) || '%' and private.plate_key(_q) <> ''
     order by private.plate_key(v.plate_number) limit 5)
    union all
    (select distinct on (lower(btrim(p.address)))
            json_build_object('key', 'address:' || lower(btrim(p.address)), 'kind', 'address', 'label', btrim(p.address), 'title', p.property_type)
     from public.suspect_properties p where p.address ilike _like order by lower(btrim(p.address)) limit 5)
  ) x);
end;
$$;
revoke execute on function public.search_graph_nodes(text) from public, anon, authenticated;
grant execute on function public.search_graph_nodes(text) to authenticated;
