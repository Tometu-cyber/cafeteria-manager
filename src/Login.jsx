import { useState } from 'react';
import { supabase } from './api.js';
import { CoffeeIcon } from './icons.jsx';

// Magic-link sign-in: Supabase emails a link that proves ownership of the address.
export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setState('sending');
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setError(error.message);
      setState('idle');
    } else {
      setState('sent');
    }
  }

  return (
    <div className="login">
      <div className="card elev-md login-card">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark"><CoffeeIcon /></div>
          <div className="brand-name">Campus Café</div>
        </div>
        <h2 style={{ margin: 0 }}>Sign in</h2>

        {state === 'sent' ? (
          <p style={{ margin: 0 }}>
            Check <strong>{email}</strong> for a sign-in link. You can close this tab once you've clicked it.
          </p>
        ) : (
          <form onSubmit={submit} className="stack gap-3">
            <p className="text-muted" style={{ margin: 0 }}>
              Enter your staff email and we'll send you a one-time link.
            </p>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            {error && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{error}</div>}
            <button className="btn btn-primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
