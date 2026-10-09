import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Reads every table and shapes it the way the screens expect.
export async function loadAll() {
  const [staff, products, shifts, assignments, busy, calendars] = await Promise.all([
    supabase.from('staff').select('*').order('id').then(check),
    supabase.from('products').select('*').order('id').then(check),
    supabase.from('shifts').select('*').order('day_order').order('time_label').then(check),
    supabase.from('shift_assignments').select('*').then(check),
    supabase.from('shift_busy').select('*').then(check),
    supabase.from('calendars').select('id, name, last_sync, staff_id').order('id').then(check),
  ]);

  const withCalendar = new Set(calendars.map((c) => c.staff_id));
  const days = [];
  for (const s of shifts) {
    let day = days.find((d) => d.name === s.day);
    if (!day) {
      day = { name: s.day, shifts: [] };
      days.push(day);
    }
    day.shifts.push({
      id: s.id,
      time: s.time_label,
      needed: s.needed,
      assigned: assignments.filter((a) => a.shift_id === s.id).map((a) => a.staff_id),
      busy: busy.filter((b) => b.shift_id === s.id).map((b) => b.staff_id),
    });
  }
  // "Free" = has a connected calendar and isn't busy for any shift that day.
  for (const day of days) {
    day.hasCalendars = withCalendar.size > 0;
    day.free = staff
      .filter((m) => withCalendar.has(m.id) && day.shifts.every((sh) => !sh.busy.includes(m.id)))
      .map((m) => m.name);
  }

  return {
    staff,
    days,
    inventory: products.map((p) => ({
      id: p.id,
      name: p.name,
      current: p.current,
      minLevel: p.min_level,
      weeklyUsage: p.weekly_usage,
      cost: p.cost,
      price: p.price,
    })),
    calendars: calendars.map((c) => ({ id: c.id, name: c.name, staffId: c.staff_id, lastSync: c.last_sync })),
  };
}

// Edge functions: account management and calendar sync run server-side.
async function invoke(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data;
}
const redirectTo = () => window.location.origin + window.location.pathname;

export const api = {
  // staff (admin only)
  createStaff: (m) => invoke('staff-admin', { action: 'create', redirectTo: redirectTo(), ...m }),
  sendLink: (email) => invoke('staff-admin', { action: 'send-link', email, redirectTo: redirectTo() }),
  deleteStaff: (id) => invoke('staff-admin', { action: 'delete', id }),
  toggleRole: (id, role) => supabase.from('staff').update({ role }).eq('id', id).then(check),

  // products
  addProduct: (p) => supabase.from('products').insert(p).then(check),
  removeProduct: (id) => supabase.from('products').delete().eq('id', id).then(check),
  adjustStock: (id, current) => supabase.from('products').update({ current }).eq('id', id).then(check),

  // shifts
  addShift: (s) =>
    supabase.from('shifts').insert({ ...s, day_order: WEEKDAYS.indexOf(s.day) + 1 }).then(check),
  updateShift: (id, s) =>
    supabase.from('shifts').update({ ...s, day_order: WEEKDAYS.indexOf(s.day) + 1 }).eq('id', id).then(check),
  deleteShift: (id) => supabase.from('shifts').delete().eq('id', id).then(check),
  async assignShift(shiftId, staffIds) {
    check(await supabase.from('shift_assignments').delete().eq('shift_id', shiftId));
    if (staffIds.length) {
      check(
        await supabase
          .from('shift_assignments')
          .insert(staffIds.map((staff_id) => ({ shift_id: shiftId, staff_id }))),
      );
    }
  },
  joinShift: (shiftId, staffId) =>
    supabase.from('shift_assignments').insert({ shift_id: shiftId, staff_id: staffId }).then(check),
  leaveShift: (shiftId, staffId) =>
    supabase.from('shift_assignments').delete().eq('shift_id', shiftId).eq('staff_id', staffId).then(check),

  // calendars
  connectCalendar: (url) => invoke('calendar-sync', { action: 'connect', url }),
  disconnectCalendar: (id) => invoke('calendar-sync', { action: 'disconnect', id }),
  syncCalendars: (force = false) => invoke('calendar-sync', { action: 'sync', force }),

  // account
  changePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },
};

export const auth = {
  signOut: () => supabase.auth.signOut(),
};
