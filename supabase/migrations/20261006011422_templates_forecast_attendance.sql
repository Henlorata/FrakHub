-- =============================================================================
-- Case templates managed by the MCB leadership, the treasury forecast on the
-- finance overview, attendance of events and the absences (approved leave) in
-- the events calendar.
--
-- Compatible with the deployed frontend: new tables and functions only; the
-- changed get_events() and get_finance_overview() keep every existing key.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Case templates: starting documents of new cases and the editor's snippets
-- ---------------------------------------------------------------------------

-- blocks: BlockNote's full block form (text nodes), the same as cases.body. Pictures are not
-- allowed (no image blocks in the template editor, no pasted data: URLs here).
create table public.case_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'document' check (kind in ('document', 'snippet')),
  label text not null check (char_length(btrim(label)) between 2 and 60),
  description text check (char_length(description) <= 200),
  icon text not null default 'file' check (icon ~ '^[a-z]{2,20}$'),
  -- Snippets: extra words the editor's "/" menu matches.
  aliases text[] not null default '{}' check (cardinality(aliases) <= 12 and char_length(array_to_string(aliases, ' ')) <= 300),
  blocks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blocks) = 'array' and octet_length(blocks::text) <= 200000 and strpos(blocks::text, 'data:image') = 0),
  sort_order integer not null default 100,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create index case_templates_order_idx on public.case_templates (kind, sort_order);
alter table public.case_templates enable row level security;
create trigger stamp_case_templates before update on public.case_templates
  for each row execute function private.stamp_update();

-- Everyone who works with cases reads them; the MCB leadership (bureau manager, MCB bureau
-- commander) writes them.
create policy case_templates_select on public.case_templates for select to authenticated
  using ((select private.can_view_cases()));
create policy case_templates_insert on public.case_templates for insert to authenticated
  with check ((select private.is_mcb_lead()));
create policy case_templates_update on public.case_templates for update to authenticated
  using ((select private.is_mcb_lead()))
  with check ((select private.is_mcb_lead()));
create policy case_templates_delete on public.case_templates for delete to authenticated
  using ((select private.is_mcb_lead()));
revoke all on public.case_templates from anon, authenticated;
grant select, delete on public.case_templates to authenticated;
grant insert (kind, label, description, icon, aliases, blocks, sort_order) on public.case_templates to authenticated;
grant update (label, description, icon, aliases, blocks, sort_order) on public.case_templates to authenticated;

-- The order of a list in one call (the ids in their new order).
create or replace function public.reorder_case_templates(_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_mcb_lead() then
    raise exception 'A sablonokat az MCB vezetése kezeli.' using errcode = '42501';
  end if;
  update public.case_templates t set sort_order = x.position * 10
  from unnest(coalesce(_ids, '{}')) with ordinality as x(id, position)
  where t.id = x.id and t.sort_order is distinct from x.position * 10;
end;
$$;
revoke execute on function public.reorder_case_templates(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_case_templates(uuid[]) to authenticated;

-- The templates that were built into the app until now.
insert into public.case_templates (kind, label, description, icon, aliases, blocks, sort_order) values
  ('document', 'Nyomozati akta', 'Összefoglaló, előzmények, helyszín, személyek, bizonyítékok, teendők és következtetés.', 'search', '{}', $json$[{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"1. Az ügy összefoglalása","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Röviden: mi történt, mikor, hol, és mi a nyomozás célja.","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"2. Előzmények, bejelentés","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Ki és hogyan jelezte az esetet, milyen korábbi ügyekhez kapcsolódik (@akta).","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"3. Helyszíni szemle","styles":{}}],"children":[]},{"type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","columnWidths":[230,400],"rows":[{"cells":[[{"type":"text","text":"Időpont","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Helyszín","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Jelen voltak","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Megállapítások","styles":{"bold":true}}],[]]}]},"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"4. Érintett személyek, vallomások","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Hivatkozz a személyekre „@” jellel; a vallomásokat idézet blokkba írd.","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"5. Bizonyítékok","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"A feltöltött fájlokat a „/bizonyíték” paranccsal illesztheted be.","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"6. Teendők","styles":{}}],"children":[]},{"type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":false},"content":[{"type":"text","text":"Tanúk kihallgatása","styles":{}}],"children":[]},{"type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":false},"content":[{"type":"text","text":"Térfigyelő felvételek bekérése","styles":{}}],"children":[]},{"type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":false},"content":[{"type":"text","text":"Parancsok igénylése","styles":{}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"7. Következtetés, javaslat","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"A nyomozás eredménye, a javasolt intézkedés (vádemelés, körözés, lezárás).","styles":{"italic":true,"textColor":"gray"}}],"children":[]}]$json$, 10),
  ('document', 'Helyszíni szemle', 'Jegyzőkönyv a helyszínről, lefoglalt tárgyakkal és fényképekkel.', 'clipboard', '{}', $json$[{"type":"heading","props":{"level":1,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Helyszíni szemle jegyzőkönyve","styles":{}}],"children":[]},{"type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","columnWidths":[230,400],"rows":[{"cells":[[{"type":"text","text":"Időpont","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Helyszín","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Szemlét végezte","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Jelen voltak","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Látási viszonyok","styles":{"bold":true}}],[]]}]},"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"A helyszín leírása","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Az épület, helyiség, jármű állapota, behatolási nyomok, sérülések.","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Lefoglalt tárgyak","styles":{}}],"children":[]},{"type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","headerRows":1,"rows":[{"cells":[[{"type":"text","text":"#","styles":{"bold":true}}],[{"type":"text","text":"Tárgy","styles":{"bold":true}}],[{"type":"text","text":"Fellelés helye","styles":{"bold":true}}],[{"type":"text","text":"Megjegyzés","styles":{"bold":true}}]]},{"cells":[[],[],[],[]]},{"cells":[[],[],[],[]]},{"cells":[[],[],[],[]]}]},"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Fényképek","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"„/bizonyíték” – a feltöltött felvételek beillesztése.","styles":{"italic":true,"textColor":"gray"}}],"children":[]}]$json$, 20),
  ('document', 'Kihallgatási jegyzőkönyv', 'Kihallgatott személy, körülmények, vallomás és a nyomozó megjegyzései.', 'messages', '{}', $json$[{"type":"heading","props":{"level":1,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Kihallgatási jegyzőkönyv","styles":{}}],"children":[]},{"type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","columnWidths":[230,400],"rows":[{"cells":[[{"type":"text","text":"Kihallgatott","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Minősége","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Időpont","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Helyszín","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Kihallgató","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Jelen voltak","styles":{"bold":true}}],[]]}]},"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Figyelmeztetések","styles":{}}],"children":[]},{"type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"A kihallgatott tájékoztatást kapott a jogairól.","styles":{}}],"children":[]},{"type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Ügyvéd jelenléte: ","styles":{}},{"type":"text","text":"igen / nem","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Vallomás","styles":{}}],"children":[]},{"type":"quote","props":{"textColor":"default","backgroundColor":"default"},"content":[{"type":"text","text":"A vallomás szövege, lehetőleg szó szerint.","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"A nyomozó megjegyzései","styles":{}}],"children":[]},{"type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Ellentmondások, viselkedés, további ellenőrizendő állítások.","styles":{"italic":true,"textColor":"gray"}}],"children":[]}]$json$, 30),
  ('snippet', 'Tanúvallomás', 'Címsor, adatok és a vallomás idézetként', 'quote', array['vallomas', 'tanu', 'statement'], $json$[{"type":"heading","props":{"level":3,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Tanúvallomás","styles":{}}],"children":[]},{"type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","columnWidths":[230,400],"rows":[{"cells":[[{"type":"text","text":"Tanú","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Időpont","styles":{"bold":true}}],[]]},{"cells":[[{"type":"text","text":"Rögzítette","styles":{"bold":true}}],[]]}]},"children":[]},{"type":"quote","props":{"textColor":"default","backgroundColor":"default"},"content":[{"type":"text","text":"A vallomás szövege.","styles":{"italic":true,"textColor":"gray"}}],"children":[]}]$json$, 10),
  ('snippet', 'Lefoglalt tárgyak', 'Táblázat a lefoglalt eszközökről', 'package', array['lefoglalt', 'targyak', 'foglalas'], $json$[{"type":"heading","props":{"level":3,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Lefoglalt tárgyak","styles":{}}],"children":[]},{"type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","headerRows":1,"rows":[{"cells":[[{"type":"text","text":"#","styles":{"bold":true}}],[{"type":"text","text":"Tárgy","styles":{"bold":true}}],[{"type":"text","text":"Fellelés helye","styles":{"bold":true}}],[{"type":"text","text":"Megjegyzés","styles":{"bold":true}}]]},{"cells":[[],[],[],[]]},{"cells":[[],[],[],[]]},{"cells":[[],[],[],[]]}]},"children":[]}]$json$, 20),
  ('snippet', 'Idővonal', 'Események időrendben', 'clock', array['idovonal', 'esemenyek', 'timeline'], $json$[{"type":"heading","props":{"level":3,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Idővonal","styles":{}}],"children":[]},{"type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"00:00 – ","styles":{"bold":true}},{"type":"text","text":"esemény","styles":{"italic":true,"textColor":"gray"}}],"children":[]},{"type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"00:00 – ","styles":{"bold":true}},{"type":"text","text":"esemény","styles":{"italic":true,"textColor":"gray"}}],"children":[]}]$json$, 30),
  ('snippet', 'Új fejezet', 'Elválasztó és címsor', 'divider', array['fejezet', 'szakasz'], $json$[{"type":"divider","props":{},"children":[]},{"type":"heading","props":{"level":2,"textColor":"default","backgroundColor":"default","textAlignment":"left","isToggleable":false},"content":[{"type":"text","text":"Új fejezet","styles":{}}],"children":[]}]$json$, 40);

-- ---------------------------------------------------------------------------
-- 2. Finance overview: the balances and the running payroll for the forecast
-- ---------------------------------------------------------------------------

create or replace function public.get_finance_overview(_months integer default 6)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _count integer := least(greatest(coalesce(_months, 6), 1), 24);
  _current date := (date_trunc('month', current_date::timestamp))::date;
  _first date := (date_trunc('month', current_date::timestamp) - make_interval(months => _count - 1))::date;
  _run public.payroll_runs%rowtype;
begin
  if not private.is_admin() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select * into _run from public.payroll_runs where month = _current;
  return json_build_object(
    'pending', (select json_build_object('count', count(*), 'amount', coalesce(sum(amount), 0))
                from public.budget_requests where status = 'pending'),
    -- The month in progress: its pay so far (what the payroll sheet shows now), without tax.
    'current', json_build_object(
      'month', _current,
      'status', coalesce(_run.status, 'open'),
      'estimate', case when _run.status is distinct from 'closed' then
        (select coalesce(sum((x ->> 'total')::bigint), 0) from jsonb_array_elements(private.payroll_rows(_current)) x) end,
      'tax_percent', (select s.tax_percent from public.payroll_settings s where s.id = 'global')),
    'months', (
      select coalesce(json_agg(json_build_object(
        'month', m.month,
        'reimbursed', (select coalesce(sum(b.amount), 0) from public.budget_requests b
                       where b.status = 'approved' and (date_trunc('month', b.updated_at))::date = m.month),
        'reimbursements', (select count(*) from public.budget_requests b
                           where b.status = 'approved' and (date_trunc('month', b.updated_at))::date = m.month),
        'payroll_status', r.status,
        'payroll_total', case when r.status = 'closed' then
          (select coalesce(sum((e.snapshot ->> 'total')::bigint), 0) from public.payroll_entries e where e.month = m.month) end,
        'payroll_withdrawn', r.withdrawn,
        'payroll_tax_percent', (r.settings ->> 'tax_percent')::numeric,
        'balance', r.balance,
        'balance_at', r.balance_at
      ) order by m.month desc), '[]'::json)
      from (select (date_trunc('month', g))::date as month
            from generate_series(_first::timestamp, current_date::timestamp, interval '1 month') g) m
      left join public.payroll_runs r on r.month = m.month)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Attendance of events (recorded by the organisers after the start)
-- ---------------------------------------------------------------------------

alter table public.events
  add column attendance_taken_at timestamptz,
  add column attendance_taken_by uuid references public.profiles(id) on delete set null;

create table public.event_attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_attendance_user_idx on public.event_attendance (user_id);
alter table public.event_attendance enable row level security;
-- The member's own rows; the organisers and the staff all. Written through set_event_attendance().
create policy event_attendance_select on public.event_attendance for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()) or exists (
    select 1 from public.events e where e.id = event_id and private.can_manage_event(e.audience)));
revoke all on public.event_attendance from anon, authenticated;
grant select on public.event_attendance to authenticated;

-- Who was there (replaces the list). From the start until 30 days later; not for cancelled events.
create or replace function public.set_event_attendance(_event_id uuid, _user_ids uuid[])
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _event public.events%rowtype;
  _ids uuid[];
begin
  select * into _event from public.events where id = _event_id for update;
  if not found or not private.can_see_event(_event.audience) then
    raise exception 'Az esemény nem található.' using errcode = 'P0002';
  end if;
  if not private.can_manage_event(_event.audience) then
    raise exception 'A jelenlétet az esemény szervezője rögzíti.' using errcode = '42501';
  end if;
  if _event.cancelled_at is not null then raise exception 'Elmaradt eseményhez nem rögzíthető jelenlét.' using errcode = '22023'; end if;
  if _event.starts_at > now() then raise exception 'A jelenlétet az esemény kezdete után rögzítheted.' using errcode = '22023'; end if;
  if _event.starts_at < now() - interval '30 days' then
    raise exception 'Egy hónapnál régebbi esemény jelenléte már nem módosítható.' using errcode = '22023';
  end if;
  if cardinality(coalesce(_user_ids, '{}')) > 500 then raise exception 'Túl sok résztvevő.' using errcode = '22023'; end if;

  select coalesce(array_agg(p.id), '{}') into _ids
  from public.profiles p where p.id = any(coalesce(_user_ids, '{}')) and p.system_role <> 'pending';
  delete from public.event_attendance where event_id = _event_id and user_id <> all(_ids);
  insert into public.event_attendance (event_id, user_id, recorded_by)
  select _event_id, x.id, _me from unnest(_ids) as x(id)
  on conflict (event_id, user_id) do nothing;
  update public.events set attendance_taken_at = now(), attendance_taken_by = _me where id = _event_id;
  return json_build_object('attended', cardinality(_ids), 'attendance_taken_at', now());
end;
$$;
revoke execute on function public.set_event_attendance(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_event_attendance(uuid, uuid[]) to authenticated;

-- get_events() with the attendance: whether it was recorded, how many came, whether the reader
-- did, and for the organisers who (unchanged otherwise).
create or replace function public.get_events(_from timestamptz, _to timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
begin
  if not private.is_member() then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  if _from is null or _to is null or _to <= _from or _to - _from > interval '400 days' then
    raise exception 'Érvénytelen időszak.' using errcode = '22023';
  end if;
  return (
    select coalesce(json_agg(row_to_json(x) order by x.starts_at, x.title), '[]'::json)
    from (
      select e.id, e.title, e.description, e.kind, e.starts_at, e.ends_at, e.location, e.audience, e.rsvp, e.cancelled_at,
             e.created_at, e.created_by, c.full_name as created_by_name,
             m.can_manage,
             mine.status as my_status, mine.note as my_note,
             (select json_build_object(
                'going', count(*) filter (where r.status = 'going'),
                'maybe', count(*) filter (where r.status = 'maybe'),
                'absent', count(*) filter (where r.status = 'absent'))
              from public.event_responses r where r.event_id = e.id) as counts,
             (select coalesce(json_agg(json_build_object(
                'user_id', r.user_id, 'status', r.status, 'full_name', p.full_name, 'badge_number', p.badge_number,
                'faction_rank', p.faction_rank, 'avatar_url', p.avatar_url,
                'note', case when r.user_id = _me or m.can_manage then r.note end)
                order by r.status, p.full_name), '[]'::json)
              from public.event_responses r join public.profiles p on p.id = r.user_id
              where r.event_id = e.id) as responses,
             e.attendance_taken_at,
             case when e.attendance_taken_at is not null then
               (select count(*) from public.event_attendance a where a.event_id = e.id) end as attended_count,
             case when e.attendance_taken_at is not null then
               exists (select 1 from public.event_attendance a where a.event_id = e.id and a.user_id = _me) end as i_attended,
             case when m.can_manage then
               (select coalesce(json_agg(a.user_id), '[]'::json) from public.event_attendance a where a.event_id = e.id) end as attendee_ids
      from public.events e
      cross join lateral (select private.can_manage_event(e.audience) as can_manage) m
      left join public.profiles c on c.id = e.created_by
      left join public.event_responses mine on mine.event_id = e.id and mine.user_id = _me
      where e.starts_at < _to and coalesce(e.ends_at, e.starts_at) >= _from
        and private.can_see_event(e.audience)
    ) x);
end;
$$;

-- A member's attendance of the last days (default 90): the events with recorded attendance
-- that were meant for them (or that they attended). The member themselves and the staff.
create or replace function public.get_member_attendance(_user_id uuid default null, _days integer default 90)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _target uuid := coalesce(_user_id, (select auth.uid()));
  _since timestamptz := now() - make_interval(days => least(greatest(coalesce(_days, 90), 7), 365));
begin
  if not private.is_member() then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  if _target is distinct from _me and not private.is_staff() then
    raise exception 'Más részvételét a vezetőség látja.' using errcode = '42501';
  end if;
  return (
    select json_build_object(
      'attended', count(*) filter (where x.attended),
      'total', count(*),
      'events', coalesce(json_agg(json_build_object(
        'id', x.id, 'title', x.title, 'kind', x.kind, 'starts_at', x.starts_at, 'audience', x.audience,
        'response', x.response, 'attended', x.attended) order by x.starts_at desc), '[]'::json))
    from (
      select e.id, e.title, e.kind, e.starts_at, e.audience,
             (select r.status from public.event_responses r where r.event_id = e.id and r.user_id = _target) as response,
             exists (select 1 from public.event_attendance a where a.event_id = e.id and a.user_id = _target) as attended
      from public.events e
      where e.attendance_taken_at is not null and e.cancelled_at is null
        and e.starts_at >= _since and e.starts_at <= now()
        and private.can_see_event(e.audience)
        and (_target = any(private.event_audience_ids(e.audience))
             or exists (select 1 from public.event_attendance a where a.event_id = e.id and a.user_id = _target))
    ) x);
end;
$$;
revoke execute on function public.get_member_attendance(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_member_attendance(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Absences: approved leave in the events calendar (dates only, like the roster)
-- ---------------------------------------------------------------------------

create or replace function public.get_absences(_from date, _to date)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  if _from is null or _to is null or _to < _from or _to - _from > 400 then
    raise exception 'Érvénytelen időszak.' using errcode = '22023';
  end if;
  return (
    select coalesce(json_agg(json_build_object(
      'user_id', r.user_id, 'full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank,
      'avatar_url', p.avatar_url, 'starts_on', r.starts_on, 'ends_on', r.ends_on) order by r.starts_on, p.full_name), '[]'::json)
    from public.hr_records r
    join public.profiles p on p.id = r.user_id
    where r.kind = 'leave' and r.status = 'active' and r.starts_on <= _to and r.ends_on >= _from and p.system_role <> 'pending');
end;
$$;
revoke execute on function public.get_absences(date, date) from public, anon, authenticated;
grant execute on function public.get_absences(date, date) to authenticated;
