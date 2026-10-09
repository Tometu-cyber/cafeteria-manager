-- Per member and shift: are they busy during it, and do they have any event that day
-- ("on campus")? Both are only hints shown on the schedule: they never decide who
-- works a shift. Someone with no events all day is not offered as "free".
-- Rewritten by the calendar-sync function on every sync (it replaces shift_busy,
-- which is kept until the new app version is live, then can be dropped).

create table if not exists public.shift_status (
  shift_id  bigint  not null references public.shifts(id) on delete cascade,
  staff_id  bigint  not null references public.staff(id)  on delete cascade,
  busy      boolean not null default false,
  on_campus boolean not null default false,
  primary key (shift_id, staff_id)
);
alter table public.shift_status enable row level security;
revoke all on public.shift_status from anon;
create policy staff_read on public.shift_status for select to authenticated using (public.is_staff());
