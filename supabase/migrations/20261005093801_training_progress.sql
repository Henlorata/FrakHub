-- Interactive trainings of the website: which training a member finished or skipped.
--
-- The trainings themselves run in the browser against an in-memory demo world (nothing they do is
-- written to the database); only this progress is stored, so a training plays once per member and
-- account, on any device. Replaying a training updates the row.

create table public.training_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  training_id text not null check (training_id ~ '^[a-z][a-z_]{1,39}$'),
  status text not null check (status in ('completed', 'skipped')),
  -- Content version of the training when it was played (a big rework can ask for a replay).
  version integer not null default 1 check (version between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, training_id)
);

alter table public.training_progress enable row level security;

create policy training_progress_select on public.training_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy training_progress_insert on public.training_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member()));
create policy training_progress_update on public.training_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.is_member()));

revoke all on public.training_progress from anon;
revoke delete, truncate, references, trigger on public.training_progress from authenticated;
grant select, insert, update on public.training_progress to authenticated;
