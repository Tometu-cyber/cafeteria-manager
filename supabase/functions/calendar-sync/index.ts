// Calendar sync. Members connect their private iCal link ("secret address in iCal
// format" in Google Calendar); this function reads it server-side and records which
// shifts they are busy for. The link is a secret: it is stored where only this
// function (service role) can read it, and never returned to the browser.
import ICAL from 'npm:ical.js@2.1.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { busyIntervals, nextOccurrence, overlaps } from './core.js';

const TZ = 'Europe/Paris';
const WINDOW_MS = 8 * 24 * 3600 * 1000;
const STALE_MS = 10 * 60 * 1000;
const MAX_ICS_CHARS = 5_000_000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

class UserError extends Error {}

// https only, and no loopback / private / internal hosts (this function fetches the URL server-side).
function safeUrl(raw: unknown): string {
  let url: URL;
  try {
    url = new URL(String(raw ?? '').trim().replace(/^webcal:/i, 'https:'));
  } catch {
    throw new UserError('That is not a valid link');
  }
  const h = url.hostname.toLowerCase();
  const privateHost =
    url.protocol !== 'https:' ||
    h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    h.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || !h.includes('.');
  if (privateHost) throw new UserError('The link must be an https calendar address');
  return url.toString();
}

async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'text/calendar' } });
  if (!res.ok) throw new UserError(`The calendar link answered with an error (${res.status})`);
  const text = await res.text();
  if (text.length > MAX_ICS_CHARS) throw new UserError('That calendar is too large');
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new UserError("That link doesn't look like a calendar (iCal) feed");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: meId } = await caller.rpc('current_staff_id');
  if (!meId) return json({ error: 'Staff only' }, 403);
  const { data: isAdmin } = await caller.rpc('is_admin');

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // Recompute "busy" shifts for these members from all of their calendars.
  async function syncStaff(staffIds: number[]) {
    const failed: number[] = [];
    const { data: shifts } = await db.from('shifts').select('id, day, time_label');
    const now = new Date();
    const occurrences = (shifts ?? [])
      .map((s) => ({ id: s.id as number, occ: nextOccurrence(s.day, s.time_label, TZ, now) }))
      .filter((x) => x.occ);

    for (const staffId of staffIds) {
      const { data: cals } = await db.from('calendars').select('id').eq('staff_id', staffId);
      const ids = (cals ?? []).map((c) => c.id);
      if (!ids.length) {
        await db.from('shift_busy').delete().eq('staff_id', staffId);
        continue;
      }
      const { data: secrets } = await db.from('calendar_secrets').select('calendar_id, ical_url').in('calendar_id', ids);
      try {
        const intervals: [number, number][] = [];
        for (const s of secrets ?? []) {
          intervals.push(...busyIntervals(ICAL, await fetchIcs(s.ical_url), now.getTime(), now.getTime() + WINDOW_MS));
        }
        const busy = occurrences
          .filter((x) => overlaps(intervals, x.occ!.start, x.occ!.end))
          .map((x) => ({ shift_id: x.id, staff_id: staffId }));
        await db.from('shift_busy').delete().eq('staff_id', staffId);
        if (busy.length) await db.from('shift_busy').insert(busy);
        await db.from('calendars').update({ last_sync: now.toISOString() }).in('id', ids);
      } catch {
        failed.push(staffId); // keep the previous result if a feed is unreachable
      }
    }
    return failed;
  }

  try {
    const action = body.action;

    if (action === 'connect') {
      const icsUrl = safeUrl(body.url);
      const text = await fetchIcs(icsUrl);
      try {
        busyIntervals(ICAL, text, Date.now(), Date.now() + 1000);
      } catch {
        throw new UserError("That link doesn't look like a calendar (iCal) feed");
      }
      const { data: me } = await db.from('staff').select('name').eq('id', meId).single();
      await db.from('calendars').delete().eq('staff_id', meId); // one calendar per member: replace
      const { data: cal, error } = await db
        .from('calendars').insert({ name: me!.name, staff_id: meId }).select('id').single();
      if (error) throw error;
      const { error: secErr } = await db.from('calendar_secrets').insert({ calendar_id: cal.id, ical_url: icsUrl });
      if (secErr) throw secErr;
      const failed = await syncStaff([meId]);
      if (failed.length) throw new UserError("Connected, but the first sync failed. Try “Sync now”.");
      return json({ ok: true });
    }

    if (action === 'disconnect') {
      const id = Number(body.id);
      const { data: cal } = await db.from('calendars').select('staff_id').eq('id', id).maybeSingle();
      if (!cal) return json({ error: 'Not found' }, 404);
      if (cal.staff_id !== meId && isAdmin !== true) return json({ error: 'Not allowed' }, 403);
      await db.from('calendars').delete().eq('id', id);
      if (cal.staff_id) await syncStaff([cal.staff_id]);
      return json({ ok: true });
    }

    if (action === 'sync') {
      const force = body.force === true;
      const { data: cals } = await db.from('calendars').select('staff_id, last_sync').not('staff_id', 'is', null);
      const cutoff = Date.now() - STALE_MS;
      const due = new Set<number>();
      for (const c of cals ?? []) {
        if (force ? (isAdmin === true || c.staff_id === meId) : !c.last_sync || new Date(c.last_sync).getTime() < cutoff) {
          due.add(c.staff_id);
        }
      }
      const failed = await syncStaff([...due]);
      return json({ ok: true, synced: due.size - failed.length, failed: failed.length });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
