import { useState } from 'react';
import Dialog from '../Dialog.jsx';
import { PlusIcon } from '../icons.jsx';

const TABS = [
  ['staff', 'Staff'],
  ['products', 'Products'],
  ['calendar', 'Calendars'],
];

// 12 random characters from an unambiguous alphabet, for suggesting a first password.
const generatePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => chars[n % chars.length]).join('');
};

function PasswordField({ id, label, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          id={id}
          name="password"
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={8}
          autoComplete="off"
          required
        />
        <button type="button" className="btn btn-secondary" onClick={() => onChange(generatePassword())}>
          Generate
        </button>
      </div>
      <span className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
        At least 8 characters. Share it with them privately; they can change it with “Forgot password”.
      </span>
    </div>
  );
}

function MemberCard({ member, isSelf, onToggle, onRemove, onPassword }) {
  const admin = member.role === 'admin';
  return (
    <div className="card elev-sm row-card">
      <div className={`avatar ${admin ? 'avatar-admin' : 'avatar-staff'}`}>{member.name.charAt(0)}</div>
      <div className="row-main">
        <div className="row-name">{member.name}</div>
        <div className="row-sub">{member.email}</div>
      </div>
      <span className={admin ? 'tag tag-accent' : 'tag tag-accent-2'}>{admin ? 'Admin' : 'Staff'}</span>
      <button className="btn btn-ghost" onClick={() => onToggle(member.id)}>
        {admin ? 'Make staff' : 'Make admin'}
      </button>
      <button className="btn btn-ghost" onClick={() => onPassword(member)}>Set password</button>
      {!isSelf && <button className="btn btn-ghost" onClick={() => onRemove(member.id)}>Remove</button>}
    </div>
  );
}

export default function Admin({ staff, inventory, calendars, actions, me }) {
  const [tab, setTab] = useState('staff');
  const [dialog, setDialog] = useState(null); // 'staff' | 'product' | 'calendar' | 'password'
  const [target, setTarget] = useState(null); // member whose password is being set
  const [pw, setPw] = useState('');
  const close = () => setDialog(null);
  const openStaff = () => {
    setPw(generatePassword());
    setDialog('staff');
  };
  const openPassword = (member) => {
    setTarget(member);
    setPw(generatePassword());
    setDialog('password');
  };
  const cardProps = {
    onToggle: actions.toggleRole,
    onRemove: actions.removeStaff,
    onPassword: openPassword,
  };

  const admins = staff.filter((m) => m.role === 'admin');
  const staffOnly = staff.filter((m) => m.role !== 'admin');

  return (
    <div className="screen-inner">
      <div>
        <div className="eyebrow">Setup</div>
        <h1 className="page-title">Team and menu</h1>
        <p className="page-lede">Who can staff the café, what it sells, and which calendars feed the schedule.</p>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            className="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'staff' && (
        <div className="stack gap-4">
          <button className="btn btn-primary self-start" onClick={openStaff}>
            <PlusIcon /> Add staff member
          </button>
          <div className="section-title">Admins</div>
          <div className="stack gap-3">
            {admins.map((m) => (
              <MemberCard key={m.id} member={m} isSelf={m.id === me?.id} {...cardProps} />
            ))}
          </div>
          <div className="section-title">Staff</div>
          <div className="stack gap-3">
            {staffOnly.map((m) => (
              <MemberCard key={m.id} member={m} isSelf={m.id === me?.id} {...cardProps} />
            ))}
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="stack gap-4">
          <button className="btn btn-primary self-start" onClick={() => setDialog('product')}>
            <PlusIcon /> Add product
          </button>
          <div className="stack gap-3">
            {inventory.map((item) => (
              <div key={item.id} className="card elev-sm row-card" style={{ gap: 'var(--space-6)' }}>
                <div className="row-main row-name">{item.name}</div>
                <div className="row-sub">Cost €{item.cost}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Price €{item.price}</div>
                <button className="btn btn-ghost" onClick={() => actions.removeProduct(item.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="stack gap-4">
          <div className="card elev-sm" style={{ padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
            <div className="section-title">Google Calendar</div>
            <p style={{ margin: 0, fontSize: 15, maxWidth: '56ch', color: 'var(--color-neutral-700)' }}>
              Read-only sync. Free time on each connected calendar shows up on the schedule, and clashes are flagged.
            </p>
            <button className="btn btn-primary self-start" onClick={() => setDialog('calendar')}>
              Connect a calendar
            </button>
          </div>
          <div className="stack gap-3">
            {calendars.map((cal) => (
              <div key={cal.id} className="card elev-sm row-card">
                <div className="row-main">
                  <div className="row-name">{cal.name}</div>
                  <div className="row-sub">Last synced {cal.lastSync}</div>
                </div>
                <span className="tag tag-accent-2">Connected</span>
                <button className="btn btn-ghost" onClick={() => actions.disconnectCalendar(cal.id)}>
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {dialog === 'staff' && (
        <Dialog
          title="Add staff member"
          submitLabel="Create account"
          onClose={close}
          onSubmit={(d) => {
            actions.addStaff({
              name: d.get('name').trim(),
              email: d.get('email').trim(),
              password: d.get('password'),
              role: d.get('admin') ? 'admin' : 'staff',
            });
            close();
          }}
        >
          <div className="field">
            <label htmlFor="s-name">Name</label>
            <input id="s-name" name="name" className="input" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="s-email">Email</label>
            <input id="s-email" name="email" type="email" className="input" required />
          </div>
          <PasswordField id="s-password" label="First password" value={pw} onChange={setPw} />
          <label className="dialog-check">
            <input type="checkbox" name="admin" /> Make this person an admin
          </label>
        </Dialog>
      )}

      {dialog === 'password' && target && (
        <Dialog
          title={`Set password for ${target.name}`}
          submitLabel="Set password"
          onClose={close}
          onSubmit={(d) => {
            actions.setPassword(target.email, d.get('password'));
            close();
          }}
        >
          <PasswordField id="pw-new" label="New password" value={pw} onChange={setPw} />
        </Dialog>
      )}

      {dialog === 'product' && (
        <Dialog
          title="Add product"
          submitLabel="Add"
          onClose={close}
          onSubmit={(d) => {
            actions.addProduct({
              name: d.get('name').trim(),
              cost: parseFloat(d.get('cost')),
              price: parseFloat(d.get('price')),
            });
            close();
          }}
        >
          <div className="field">
            <label htmlFor="p-name">Product name</label>
            <input id="p-name" name="name" className="input" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="p-cost">Cost per unit (€)</label>
            <input id="p-cost" name="cost" type="number" min="0" step="any" className="input" required />
          </div>
          <div className="field">
            <label htmlFor="p-price">Selling price (€)</label>
            <input id="p-price" name="price" type="number" min="0" step="any" className="input" required />
          </div>
        </Dialog>
      )}

      {dialog === 'calendar' && (
        <Dialog title="Connect a calendar" onClose={close}>
          Google Calendar sign-in is coming in the next iteration.
        </Dialog>
      )}
    </div>
  );
}
