import { useState } from 'react';
import Dialog from '../Dialog.jsx';

export default function Schedule({ days, staff, me, isAdmin, assignShift, toggleSelf }) {
  const [editing, setEditing] = useState(null); // { shift, dayName }

  return (
    <div className="screen-inner">
      <div>
        <div className="eyebrow">This week</div>
        <h1 className="page-title">Who's on the counter</h1>
        <p className="page-lede">Shifts open for cover, and the people whose calendars are free.</p>
      </div>

      <div className="stack gap-6">
        {days.map((day) => (
          <div key={day.name} className="card elev-sm day-card">
            <div className="day-name">{day.name}</div>
            <div className="shift-grid">
              {day.shifts.map((shift) => {
                const open = shift.needed - shift.assigned.length;
                return (
                  <div key={shift.id} className="shift">
                    <div className="shift-head">
                      <div className="shift-time">{shift.time}</div>
                      <span className={open > 0 ? 'tag tag-accent' : 'tag tag-accent-2'}>
                        {open > 0 ? `${open} open` : 'Full'}
                      </span>
                    </div>
                    <div className="shift-staffed">
                      {shift.assigned.length} of {shift.needed} staffed
                    </div>
                    {isAdmin ? (
                      <button
                        className="btn btn-secondary self-start"
                        onClick={() => setEditing({ shift, dayName: day.name })}
                      >
                        Assign staff
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary self-start"
                        disabled={open <= 0 && !shift.assigned.includes(me.id)}
                        onClick={() => toggleSelf(shift.id, shift.assigned.includes(me.id))}
                      >
                        {shift.assigned.includes(me.id) ? 'Leave shift' : 'Take shift'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="free-row">
              <div className="label-caps">Free</div>
              {day.available.map((person) => (
                <span key={person} className="tag tag-accent-2 tag-lg">{person}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Dialog
          title={`${editing.dayName} · ${editing.shift.time}`}
          submitLabel="Save"
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            assignShift(editing.shift.id, data.getAll('staff').map(Number));
            setEditing(null);
          }}
        >
          <p className="text-muted" style={{ margin: 0 }}>
            Choose up to {editing.shift.needed} people for this shift.
          </p>
          {staff.map((m) => (
            <label key={m.id} className="dialog-check">
              <input
                type="checkbox"
                name="staff"
                value={m.id}
                defaultChecked={editing.shift.assigned.includes(m.id)}
              />
              {m.name}
            </label>
          ))}
        </Dialog>
      )}
    </div>
  );
}
