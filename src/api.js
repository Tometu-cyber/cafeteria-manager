import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const fmtSync = (ts) =>
  ts ? new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'never';

// Reads every table and shapes it the way the screens expect.
export async function loadAll() {
  const [staff, products, shifts, assignments, availability, calendars] = await Promise.all([
    supabase.from('staff').select('*').order('id').then(check),
    supabase.from('products').select('*').order('id').then(check),
    supabase.from('shifts').select('*').order('day_order').order('id').then(check),
    supabase.from('shift_assignments').select('*').then(check),
    supabase.from('availability').select('*').then(check),
    supabase.from('calendars').select('*').order('id').then(check),
  ]);

  const nameOf = new Map(staff.map((m) => [m.id, m.name]));
  const days = [];
  for (const s of shifts) {
    let day = days.find((d) => d.name === s.day);
    if (!day) {
      day = {
        name: s.day,
        shifts: [],
        available: availability.filter((a) => a.day === s.day).map((a) => nameOf.get(a.staff_id)).filter(Boolean),
      };
      days.push(day);
    }
    day.shifts.push({
      id: s.id,
      time: s.time_label,
      needed: s.needed,
      assigned: assignments.filter((a) => a.shift_id === s.id).map((a) => a.staff_id),
    });
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
    calendars: calendars.map((c) => ({ id: c.id, name: c.name, lastSync: fmtSync(c.last_sync) })),
  };
}

export const api = {
  addStaff: (m) => supabase.from('staff').insert(m).then(check),
  toggleRole: (id, role) => supabase.from('staff').update({ role }).eq('id', id).then(check),
  removeStaff: (id) => supabase.from('staff').delete().eq('id', id).then(check),

  addProduct: (p) => supabase.from('products').insert(p).then(check),
  removeProduct: (id) => supabase.from('products').delete().eq('id', id).then(check),
  adjustStock: (id, current) => supabase.from('products').update({ current }).eq('id', id).then(check),

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

  removeCalendar: (id) => supabase.from('calendars').delete().eq('id', id).then(check),
};

export const auth = {
  signOut: () => supabase.auth.signOut(),
};

api.joinShift = (shiftId, staffId) =>
  supabase.from('shift_assignments').insert({ shift_id: shiftId, staff_id: staffId }).then(check);
api.leaveShift = (shiftId, staffId) =>
  supabase.from('shift_assignments').delete().eq('shift_id', shiftId).eq('staff_id', staffId).then(check);
