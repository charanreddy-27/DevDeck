'use client';

import Link from 'next/link';
import { useState } from 'react';
import { hardNavigate } from '@/lib/client';

const MESSAGES = {
  unauthorized: 'That password is not right.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
};

/**
 * Posts to /api/auth/login. It is also a plain HTML form with an action, so
 * signing in works before (or without) JavaScript — the endpoint answers a
 * form post with a redirect instead of JSON.
 */
export default function LoginForm({ enabled, next, initialError }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ? MESSAGES[initialError] || MESSAGES.unauthorized : null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password, next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message || MESSAGES.unauthorized);
        setBusy(false);
        return;
      }
      // A full navigation, so the proxy sees the new cookie on the next request.
      hardNavigate(data?.next || '/');
    } catch {
      setError('Could not reach DevDeck. Check your connection and try again.');
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <div className="login">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">No password needed</div>
          </div>
          <div className="panel-body">
            <p className="muted" style={{ marginTop: 0 }}>
              This deployment is not password protected. Set <code className="mono">DEVDECK_PASSWORD</code> to turn the
              gate on.
            </p>
            <Link href="/" className="btn btn-primary">
              Open the dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Sign in to DevDeck</div>
          <span className="pill is-idle">
            <span className="dot" aria-hidden="true" />
            Protected
          </span>
        </div>
        <div className="panel-body">
          <form method="post" action="/api/auth/login" onSubmit={onSubmit}>
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoFocus
              />
            </div>
            {error ? (
              <div className="banner" role="alert" style={{ marginBottom: 0 }}>
                <div className="banner-title">{error}</div>
              </div>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={busy || !password}>
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Signing in
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
