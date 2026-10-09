import { useState } from 'react';
import { supabase } from './api.js';
import { CoffeeIcon } from './icons.jsx';

const redirectTo = () => window.location.origin + window.location.pathname;

function Shell({ title, children }) {
  return (
    <div className="login">
      <div className="card elev-md login-card">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark"><CoffeeIcon /></div>
          <div className="brand-name">Campus Café</div>
        </div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const Field = ({ id, label, ...props }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} className="input" {...props} />
  </div>
);

const Error = ({ children }) =>
  children ? <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{children}</div> : null;

// Email + password sign-in. New accounts and password resets go through an
// emailed link, which proves the person owns the address.
export default function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null); // message shown after sign-up / reset request

  const switchTo = (m) => {
    setMode(m);
    setError(null);
    setSent(null);
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const addr = email.trim();
    let res;
    if (mode === 'signin') {
      res = await supabase.auth.signInWithPassword({ email: addr, password });
    } else if (mode === 'signup') {
      res = await supabase.auth.signUp({ email: addr, password, options: { emailRedirectTo: redirectTo() } });
      if (!res.error) setSent(`We sent a confirmation link to ${addr}. Click it, then sign in.`);
    } else {
      res = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: redirectTo() });
      if (!res.error) setSent(`If ${addr} has an account, a reset link is on its way.`);
    }
    if (res.error) setError(res.error.message);
    setBusy(false);
  }

  const titles = { signin: 'Sign in', signup: 'Create your account', forgot: 'Reset your password' };

  if (sent) {
    return (
      <Shell title={titles[mode]}>
        <p style={{ margin: 0 }}>{sent}</p>
        <button className="btn btn-secondary" onClick={() => switchTo('signin')}>Back to sign in</button>
      </Shell>
    );
  }

  return (
    <Shell title={titles[mode]}>
      <form onSubmit={submit} className="stack gap-3">
        {mode === 'signup' && (
          <p className="text-muted" style={{ margin: 0 }}>
            Use the email an admin added to the staff list.
          </p>
        )}
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          required
        />
        {mode !== 'forgot' && (
          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            required
          />
        )}
        <Error>{error}</Error>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Email me a reset link' }[mode]}
        </button>
      </form>

      <div className="login-links">
        {mode === 'signin' && (
          <>
            <button className="btn btn-ghost" onClick={() => switchTo('forgot')}>Forgot password?</button>
            <button className="btn btn-ghost" onClick={() => switchTo('signup')}>Create account</button>
          </>
        )}
        {mode !== 'signin' && (
          <button className="btn btn-ghost" onClick={() => switchTo('signin')}>Back to sign in</button>
        )}
      </div>
    </Shell>
  );
}

// Shown after following a password-reset link.
export function SetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="stack gap-3">
        <Field
          id="new-password"
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          autoFocus
          required
        />
        <Error>{error}</Error>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Shell>
  );
}
