-- Staff rows (and their logins) are now created/deleted only by the staff-admin
-- edge function, which runs with the service role. Admins may still edit rows
-- (e.g. change a role) directly.
drop policy if exists admin_write on public.staff;
create policy admin_update on public.staff
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
