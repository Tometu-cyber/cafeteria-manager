import { useCallback, useEffect, useState } from 'react';
import { supabase, loadAll, api, auth } from './api.js';
import Login from './Login.jsx';
import { CoffeeIcon, CalendarIcon, PackageIcon, SlidersIcon } from './icons.jsx';
import Schedule from './screens/Schedule.jsx';
import Inventory from './screens/Inventory.jsx';
import Admin from './screens/Admin.jsx';

const NAV = [
  ['schedule', 'Schedule', CalendarIcon, false],
  ['inventory', 'Inventory', PackageIcon, false],
  ['admin', 'Admin', SlidersIcon, true], // admin only
];

const EMPTY = { staff: [], inventory: [], calendars: [], days: [] };

export default function App() {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <Login />;
  return <Signed session={session} />;
}

function Signed({ session }) {
  const [screen, setScreen] = useState('schedule');
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setData(await loadAll());
      setStatus('ready');
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
      setStatus((s) => (s === 'loading' ? 'error' : s));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Run a write, then reload everything so the screens match the database.
  const run = (fn) => async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      setError(e.message || String(e));
      return;
    }
    await refresh();
  };

  const email = session.user.email?.toLowerCase();
  const me = data.staff.find((m) => m.email.toLowerCase() === email);
  const isAdmin = me?.role === 'admin';

  const actions = {
    addStaff: run(api.addStaff),
    toggleRole: run((id) => api.toggleRole(id, data.staff.find((m) => m.id === id).role === 'admin' ? 'staff' : 'admin')),
    removeStaff: run(api.removeStaff),
    addProduct: run((p) => api.addProduct({ name: p.name, cost: p.cost, price: p.price })),
    removeProduct: run(api.removeProduct),
    disconnectCalendar: run(api.removeCalendar),
  };
  const assignShift = run(api.assignShift);
  const adjustStock = run(api.adjustStock);
  const toggleSelf = run((shiftId, joined) =>
    joined ? api.leaveShift(shiftId, me.id) : api.joinShift(shiftId, me.id),
  );

  const signOutButton = (
    <button className="btn btn-secondary" onClick={() => auth.signOut()}>Sign out</button>
  );

  // Signed in, but the email isn't on the staff list (RLS returns no rows).
  if (status === 'ready' && !me) {
    return (
      <div className="login">
        <div className="card elev-md login-card">
          <h2 style={{ margin: 0 }}>No access yet</h2>
          <p style={{ margin: 0 }}>
            <strong>{session.user.email}</strong> isn't on the staff list. Ask an admin to add this address, then sign in again.
          </p>
          {signOutButton}
        </div>
      </div>
    );
  }

  const visible = (id) => id !== 'admin' || isAdmin;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <div className="brand-mark"><CoffeeIcon /></div>
          <div className="brand-name">Campus Café</div>
        </div>
        <div className="side-nav">
          {NAV.filter(([id]) => visible(id)).map(([id, label, Icon]) => (
            <button
              key={id}
              className="nav-item"
              aria-current={screen === id ? 'page' : undefined}
              onClick={() => setScreen(id)}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <div className="who">{me?.name ?? session.user.email}</div>
          {signOutButton}
        </div>
      </nav>

      <main className="main">
        <div className="screen">
          {error && (
            <div className="card elev-sm notice" role="alert">
              <div>
                <strong>Something went wrong.</strong> <span className="text-muted">{error}</span>
              </div>
              <button className="btn btn-secondary" onClick={refresh}>Retry</button>
            </div>
          )}
          {status === 'loading' && <p className="text-muted">Loading…</p>}
          {status === 'ready' && screen === 'schedule' && (
            <Schedule
              days={data.days}
              staff={data.staff}
              me={me}
              isAdmin={isAdmin}
              assignShift={assignShift}
              toggleSelf={toggleSelf}
            />
          )}
          {status === 'ready' && screen === 'inventory' && (
            <Inventory inventory={data.inventory} adjustStock={adjustStock} canEdit={isAdmin} />
          )}
          {status === 'ready' && screen === 'admin' && isAdmin && (
            <Admin staff={data.staff} inventory={data.inventory} calendars={data.calendars} actions={actions} />
          )}
        </div>
      </main>
    </div>
  );
}
