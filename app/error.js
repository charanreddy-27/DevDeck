'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Catches render-time crashes so a bad payload never leaves a blank screen. */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[devdeck] render error:', error?.message);
  }, [error]);

  return (
    <div className="panel" style={{ maxWidth: 640, margin: '48px auto' }}>
      <div className="panel-head">
        <div className="panel-title">Something broke in the UI</div>
        <span className="pill is-error">
          <span className="dot" aria-hidden="true" />
          Error
        </span>
      </div>
      <div className="panel-body">
        <p className="muted" style={{ marginTop: 0 }}>
          DevDeck hit an unexpected error while rendering this view. Your tokens and projects are untouched.
        </p>
        {error?.message ? <pre className="code-block">{error.message}</pre> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
