import { useCallback, useEffect, useState } from 'react';
import { loadAll, api } from './api.js';
import { CoffeeIcon, CalendarIcon, PackageIcon, SlidersIcon } from './icons.jsx';
import Schedule from './screens/Schedule.jsx';
import Inventory from './screens/Inventory.jsx';
import Admin from './screens/Admin.jsx';

const NAV = [
  ['schedule', 'Schedule', CalendarIcon],
  ['inventory', 'Inventory', PackageIcon],
  ['admin', 'Admin', SlidersIcon],
];

const EMPTY = { staff: [], inventory: [], calendars: [], days: [] };

export default function App() {
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

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <div className="brand-mark"><CoffeeIcon /></div>
          <div className="brand-name">Campus Café</div>
        </div>
        <div className="side-nav">
          {NAV.map(([id, label, Icon]) => (
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
      </nav>

      <main className="main">
        <div className="screen">
          {error && (
            <div className="card elev-sm notice" role="alert">
              <div>
                <strong>Couldn't reach the database.</strong> <span className="text-muted">{error}</span>
              </div>
              <button className="btn btn-secondary" onClick={refresh}>Retry</button>
            </div>
          )}
          {status === 'loading' && <p className="text-muted">Loading…</p>}
          {status === 'ready' && screen === 'schedule' && (
            <Schedule days={data.days} staff={data.staff} assignShift={assignShift} />
          )}
          {status === 'ready' && screen === 'inventory' && (
            <Inventory inventory={data.inventory} adjustStock={adjustStock} />
          )}
          {status === 'ready' && screen === 'admin' && (
            <Admin staff={data.staff} inventory={data.inventory} calendars={data.calendars} actions={actions} />
          )}
        </div>
      </main>
    </div>
  );
}
