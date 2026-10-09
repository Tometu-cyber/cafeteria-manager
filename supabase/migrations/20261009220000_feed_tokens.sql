-- Personal subscription feed ("add my shifts to my calendar"). Each member gets a
-- secret token; the calendar-sync function serves their next shifts at
-- .../functions/v1/calendar-sync?t=<token>. The token is the only credential, so the
-- table is unreachable from the browser (RLS on, no policies, no grants) and can be
-- rotated from the app.

create table if not exists public.feed_tokens (
  staff_id bigint primary key references public.staff(id) on delete cascade,
  token    text not null unique
);
alter table public.feed_tokens enable row level security;
revoke all on public.feed_tokens from anon, authenticated;
