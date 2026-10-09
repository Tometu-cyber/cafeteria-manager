-- Role-based access. A signed-in user is "staff" when their (verified) login
-- email matches a row in public.staff; "admin" when that row has role = 'admin'.
-- Signed-out visitors (anon) get nothing.

create or replace function public.current_staff_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select id from public.staff
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_staff_id() is not null $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin'
  )
$$;

revoke all on function public.current_staff_id(), public.is_staff(), public.is_admin() from public, anon;
grant execute on function public.current_staff_id(), public.is_staff(), public.is_admin() to authenticated;

-- Replace the temporary open policies.
do $$
declare t text;
begin
  foreach t in array array['staff','products','shifts','shift_assignments','availability','calendars']
  loop
    execute format('drop policy if exists open_all on public.%I', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Everything is readable by staff and writable by admins...
do $$
declare t text;
begin
  foreach t in array array['staff','products','shifts','availability','calendars']
  loop
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('create policy admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ...except shift sign-ups, where staff may add/remove only themselves.
create policy staff_read on public.shift_assignments
  for select to authenticated using (public.is_staff());
create policy self_or_admin_insert on public.shift_assignments
  for insert to authenticated
  with check (public.is_admin() or staff_id = public.current_staff_id());
create policy self_or_admin_delete on public.shift_assignments
  for delete to authenticated
  using (public.is_admin() or staff_id = public.current_staff_id());
create policy admin_update on public.shift_assignments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- First real admin.
insert into public.staff (name, email, role)
values ('Matis Demore', 'matis.demore@bdemiagenice.com', 'admin')
on conflict (email) do update set role = 'admin';
