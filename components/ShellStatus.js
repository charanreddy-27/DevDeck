'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useToast } from './ToastProvider';
import { fetchJson, getMode, hardNavigate, subscribeMode } from '@/lib/client';

// One status request per page load, shared by every component that asks.
let statusPromise = null;
function loadStatus() {
  statusPromise ||= fetchJson('/api/status').catch(() => null);
  return statusPromise;
}

function useAppStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    loadStatus().then((value) => {
      if (alive) setStatus(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

/**
 * Slim strip under the top bar whenever the data on screen is simulated.
 * Driven by the `mode` every API response carries, so it appears the moment
 * the first demo response lands.
 */
export function DemoBanner() {
  const toast = useToast();
  const mode = useSyncExternalStore(subscribeMode, getMode, () => null);
  const status = useAppStatus();
  const [leaving, setLeaving] = useState(false);

  if (mode !== 'demo') return null;
  const forced = Boolean(status?.demo?.forced);

  async function exitDemo() {
    setLeaving(true);
    try {
      await fetchJson('/api/demo', { method: 'DELETE' });
      hardNavigate('/');
    } catch (error) {
      setLeaving(false);
      toast.error(error.hint ? `${error.message} ${error.hint}` : error.message);
    }
  }

  return (
    <div className="demo-banner" role="status">
      <span className="demo-tag">Demo data</span>
      <p>
        Simulated projects, builds and commits{forced ? ' — edits and redeploys run in memory' : ''}. Nothing here
        touches a real account.
      </p>
      {forced ? null : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={exitDemo} disabled={leaving}>
          {leaving ? 'Leaving' : 'Exit demo'}
        </button>
      )}
    </div>
  );
}

/** Shown in the top bar only when the password gate is on. */
export function SignOutButton() {
  const status = useAppStatus();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  if (!status?.auth?.enabled || pathname === '/login') return null;

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      hardNavigate('/login');
    }
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={signOut} disabled={busy}>
      Sign out
    </button>
  );
}
