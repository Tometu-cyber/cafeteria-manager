import { useState } from 'react';
import { useT } from '../i18n.jsx';

// Each member connects their own private iCal link; admins see everyone's in Admin → Calendars.
export default function MyCalendar({ mine, actions }) {
  const { t, fmtDate } = useT();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const connect = async (e) => {
    e.preventDefault();
    setBusy(true);
    setDone(null);
    const ok = await actions.connectCalendar(url.trim());
    setBusy(false);
    if (ok) {
      setUrl('');
      setDone(t('Calendar connected.'));
    }
  };

  return (
    <div className="screen-inner">
      <div>
        <div className="eyebrow">{t('Your availability')}</div>
        <h1 className="page-title">{t('My calendar')}</h1>
        <p className="page-lede">
          {t('Connect your calendar and the schedule shows when you are free, and flags a shift that clashes with an event.')}
        </p>
      </div>

      {mine && (
        <div className="card elev-sm row-card">
          <div className="row-main">
            <div className="row-name">{t('Calendar connected')}</div>
            <div className="row-sub">{t('Last synced {date}', { date: fmtDate(mine.lastSync) })}</div>
          </div>
          <span className="tag tag-accent-2">{t('Connected')}</span>
          <button className="btn btn-secondary" onClick={() => actions.syncNow()}>{t('Sync now')}</button>
          <button className="btn btn-ghost" onClick={() => actions.disconnectCalendar(mine.id)}>{t('Disconnect')}</button>
        </div>
      )}

      <div className="card elev-sm" style={{ padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <div className="section-title">{mine ? t('Use a different calendar') : t('Connect a calendar')}</div>
        <ol className="steps">
          <li>{t('In Google Calendar, open Settings and pick your calendar under “Settings for my calendars”.')}</li>
          <li>{t('Scroll to “Integrate calendar” and copy the “Secret address in iCal format”.')}</li>
          <li>{t('Paste it below. We only read whether you are busy; event titles are never stored.')}</li>
        </ol>
        <form onSubmit={connect} className="stack gap-3">
          <div className="field">
            <label htmlFor="ical">{t('Secret iCal address')}</label>
            <input
              id="ical"
              className="input"
              type="url"
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <button className="btn btn-primary self-start" disabled={busy}>
            {busy ? t('Connecting…') : t('Connect')}
          </button>
          {done && <div role="status" className="text-muted" style={{ fontSize: 13 }}>{done}</div>}
        </form>
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
          {t('Treat the address like a password: anyone with it can read your calendar. You can reset it in Google Calendar at any time.')}
        </p>
      </div>
    </div>
  );
}
