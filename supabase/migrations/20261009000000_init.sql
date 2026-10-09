-- Campus Café — initial schema.
-- Access is OPEN for now (anon role can read/write everything). When login is
-- added, replace the "open_*" policies with ones that check auth.uid() / role.

create table if not exists public.staff (
  id         bigint generated always as identity primary key,
  name       text not null,
  email      text not null unique,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id           bigint generated always as identity primary key,
  name         text not null,
  current      numeric not null default 0 check (current >= 0),
  min_level    numeric not null default 5 check (min_level >= 0),
  weekly_usage numeric not null default 0 check (weekly_usage >= 0),
  cost         numeric not null default 0 check (cost >= 0),
  price        numeric not null default 0 check (price >= 0),
  created_at   timestamptz not null default now()
);

create table if not exists public.shifts (
  id         bigint generated always as identity primary key,
  day        text not null,
  day_order  int  not null,
  time_label text not null,
  needed     int  not null default 2 check (needed > 0)
);

create table if not exists public.shift_assignments (
  shift_id bigint not null references public.shifts(id) on delete cascade,
  staff_id bigint not null references public.staff(id)  on delete cascade,
  primary key (shift_id, staff_id)
);

-- Who is free on which day (fed by calendars later).
create table if not exists public.availability (
  day      text   not null,
  staff_id bigint not null references public.staff(id) on delete cascade,
  primary key (day, staff_id)
);

create table if not exists public.calendars (
  id        bigint generated always as identity primary key,
  name      text not null,
  last_sync timestamptz
);

-- Row level security: open to the anon key for now.
do $$
declare t text;
begin
  foreach t in array array['staff','products','shifts','shift_assignments','availability','calendars']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists open_all on public.%I', t);
    execute format('create policy open_all on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Seed data from the design prototype (only when empty).
insert into public.staff (name, email, role)
select * from (values
  ('Alice Chen',    'alice@org.edu',  'admin'),
  ('Dana Okafor',   'dana@org.edu',   'admin'),
  ('Bob Martinez',  'bob@org.edu',    'staff'),
  ('Carol Singh',   'carol@org.edu',  'staff'),
  ('Elliot Wright', 'elliot@org.edu', 'staff')
) v(name, email, role)
where not exists (select 1 from public.staff);

insert into public.products (name, current, min_level, weekly_usage, cost, price)
select * from (values
  ('Coffee Beans', 12, 5, 8, 15, 35),
  ('Milk',          3, 4, 6,  4, 10),
  ('Pastries',     18, 10, 12, 2,  6),
  ('Cups',        200, 100, 80, 0.2, 0)
) v(name, current, min_level, weekly_usage, cost, price)
where not exists (select 1 from public.products);

insert into public.shifts (day, day_order, time_label, needed)
select * from (values
  ('Monday',  1, '10:00–12:00', 2),
  ('Monday',  1, '12:00–14:00', 2),
  ('Tuesday', 2, '10:00–12:00', 2),
  ('Tuesday', 2, '12:00–14:00', 2)
) v(day, day_order, time_label, needed)
where not exists (select 1 from public.shifts);

insert into public.shift_assignments (shift_id, staff_id)
select s.id, st.id from public.shifts s join public.staff st on
     (s.day = 'Monday'  and s.time_label = '10:00–12:00' and st.name = 'Alice Chen')
  or (s.day = 'Monday'  and s.time_label = '12:00–14:00' and st.name in ('Dana Okafor', 'Bob Martinez'))
  or (s.day = 'Tuesday' and s.time_label = '12:00–14:00' and st.name = 'Carol Singh')
on conflict do nothing;

insert into public.availability (day, staff_id)
select d.day, st.id from (values
  ('Monday', 'Carol Singh'), ('Monday', 'Bob Martinez'),
  ('Tuesday', 'Alice Chen'), ('Tuesday', 'Carol Singh')
) d(day, name) join public.staff st on st.name = d.name
on conflict do nothing;

insert into public.calendars (name, last_sync)
select 'Alice Chen', now() where not exists (select 1 from public.calendars);
