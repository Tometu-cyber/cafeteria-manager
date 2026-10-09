-- Calendar sync: members connect a private iCal link; the calendar-sync function
-- (service role) reads it and records only WHICH SHIFTS they are busy for.
-- Event titles/details are never stored.

alter table public.calendars
  add column if not exists staff_id bigint references public.staff(id) on delete cascade;

-- The secret iCal address. RLS on with no policies and no grants: unreachable from
-- the browser, readable only by the service role inside the edge function.
create table if not exists public.calendar_secrets (
  calendar_id bigint primary key references public.calendars(id) on delete cascade,
  ical_url    text not null
);
alter table public.calendar_secrets enable row level security;
revoke all on public.calendar_secrets from anon, authenticated;

-- Which shifts each connected member is busy for (recomputed on every sync).
create table if not exists public.shift_busy (
  shift_id bigint not null references public.shifts(id) on delete cascade,
  staff_id bigint not null references public.staff(id)  on delete cascade,
  primary key (shift_id, staff_id)
);
alter table public.shift_busy enable row level security;
revoke all on public.shift_busy from anon;
create policy staff_read on public.shift_busy for select to authenticated using (public.is_staff());

-- Replaced by shift_busy.
drop table if exists public.availability;
