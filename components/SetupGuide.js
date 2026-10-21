'use client';

import { useState } from 'react';
import { useToast } from './ToastProvider';
import { fetchJson, hardNavigate } from '@/lib/client';

/**
 * Shown instead of the dashboard whenever a token is missing or rejected —
 * the first-run experience is the setup guide itself. With no tokens at all,
 * it also offers the demo: simulated data, so a visitor can try every feature
 * without connecting an account.
 */
export default function SetupGuide({ error }) {
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const service = error?.service;
  const missing = error?.code === 'missing_token';

  async function exploreDemo() {
    setStarting(true);
    try {
      await fetchJson('/api/demo', { method: 'POST' });
      hardNavigate('/');
    } catch (err) {
      setStarting(false);
      toast.error(err.hint ? `${err.message} ${err.hint}` : err.message);
    }
  }

  return (
    <div className="setup">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">
            {missing ? 'Finish setting up DevDeck' : 'DevDeck could not authenticate'}
          </div>
          <span className={`pill ${missing ? 'is-idle' : 'is-error'}`}>
            <span className="dot" aria-hidden="true" />
            {missing ? 'Not configured' : 'Token rejected'}
          </span>
        </div>

        <div className="panel-body">
          <p className="muted" style={{ marginTop: 0 }}>
            {error?.message || 'DevDeck needs a Vercel token and a GitHub token to talk to your accounts.'}
            {error?.hint ? ` ${error.hint}` : ''}
          </p>

          {missing ? (
            <div className="demo-cta">
              <div>
                <div className="demo-cta-title">Just looking?</div>
                <div className="demo-cta-sub">
                  Explore DevDeck with simulated projects — live builds, logs, redeploys and commits. Nothing connects to
                  a real account.
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={exploreDemo} disabled={starting}>
                {starting ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Starting demo
                  </>
                ) : (
                  'Explore the live demo'
                )}
              </button>
            </div>
          ) : null}

          <ol className="setup-steps">
            <li>
              <h4>Create a Vercel token</h4>
              <p>
                Go to{' '}
                <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer">
                  vercel.com/account/tokens
                </a>{' '}
                and create a token with access to the scope your projects live in.
              </p>
            </li>
            <li>
              <h4>Create a GitHub token</h4>
              <p>
                Go to{' '}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
                  github.com/settings/tokens
                </a>{' '}
                and generate a classic token with the <code className="mono">repo</code> scope (or a fine-grained token
                with Contents: read &amp; write on the repos you want to edit).
              </p>
            </li>
            <li>
              <h4>Add them to .env.local</h4>
              <p>Create the file in the project root — it is git-ignored, so the tokens stay on your machine.</p>
              <pre className="code-block">
{`VERCEL_TOKEN=your_vercel_token
GITHUB_TOKEN=your_github_token
# only if your projects live under a Vercel team
VERCEL_TEAM_ID=team_xxxxxxxx`}
              </pre>
            </li>
            <li>
              <h4>Restart the dev server</h4>
              <p>Next.js reads env files at boot, so stop and restart it — then reload this page.</p>
              <pre className="code-block">npm run dev</pre>
            </li>
          </ol>

          {service === 'vercel' && !missing ? (
            <div className="banner banner-warn" style={{ marginTop: 20, marginBottom: 0 }}>
              <div>
                <div className="banner-title">Projects under a team?</div>
                <div className="banner-hint">
                  If your projects belong to a Vercel team rather than your personal account, set{' '}
                  <code className="mono">VERCEL_TEAM_ID</code> in <code className="mono">.env.local</code> as well.
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
