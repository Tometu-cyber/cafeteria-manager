import { useState } from 'react';
import Dialog from '../Dialog.jsx';

export default function Inventory({ inventory, adjustStock, canEdit }) {
  const [adjusting, setAdjusting] = useState(null);

  const totalItems = inventory.reduce((s, i) => s + i.current, 0);
  const lowStockCount = inventory.filter((i) => i.current <= i.minLevel).length;
  const weeklyUsage = inventory.reduce((s, i) => s + i.weeklyUsage, 0);

  return (
    <div className="screen-inner">
      <div>
        <div className="eyebrow">Stock room</div>
        <h1 className="page-title">What's on the shelf</h1>
        <p className="page-lede">Levels against the minimum, and what each item used this week.</p>
      </div>

      <div className="stat-grid">
        <div className="card elev-sm stat">
          <div className="label-caps">Units in stock</div>
          <div className="stat-value" style={{ color: 'var(--color-accent-2-700)' }}>{totalItems}</div>
        </div>
        <div className="card elev-sm stat">
          <div className="label-caps">Running low</div>
          <div className="stat-value" style={{ color: 'var(--color-accent-700)' }}>{lowStockCount}</div>
        </div>
        <div className="card elev-sm stat">
          <div className="label-caps">Used this week</div>
          <div className="stat-value">{weeklyUsage}</div>
        </div>
      </div>

      <div className="card elev-sm table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Level</th>
              <th>In stock</th>
              <th>Minimum</th>
              <th>This week</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => {
              const low = item.current <= item.minLevel;
              const pct = Math.max(4, Math.min(100, Math.round((item.current / (item.minLevel * 3)) * 100)));
              return (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>
                    <div className="meter" role="img" aria-label={`${pct}% of target level`}>
                      <span
                        style={{
                          width: `${pct}%`,
                          background: low ? 'var(--color-accent)' : 'var(--color-accent-2)',
                        }}
                      />
                    </div>
                  </td>
                  <td>{item.current}</td>
                  <td>{item.minLevel}</td>
                  <td>{item.weeklyUsage}</td>
                  <td>
                    <span className={low ? 'tag tag-accent' : 'tag tag-accent-2'}>{low ? 'Low' : 'OK'}</span>
                  </td>
                  <td className="t-right">
                    {canEdit && (
                      <button className="btn btn-ghost" onClick={() => setAdjusting(item)}>Adjust</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adjusting && (
        <Dialog
          title={`Adjust ${adjusting.name}`}
          onClose={() => setAdjusting(null)}
          onSubmit={(data) => {
            adjustStock(adjusting.id, Math.max(0, Number(data.get('current'))));
            setAdjusting(null);
          }}
        >
          <div className="field">
            <label htmlFor="current">Units in stock</label>
            <input
              id="current"
              name="current"
              className="input"
              type="number"
              min="0"
              step="any"
              defaultValue={adjusting.current}
              autoFocus
              required
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
