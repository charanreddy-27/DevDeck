'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ErrorBanner from './ErrorBanner';
import { Line } from './Skeletons';
import { fetchJson } from '@/lib/client';
import { clockTime, cx } from '@/lib/format';

const TAIL_MS = 5000;
const PIN_THRESHOLD_PX = 48;

/**
 * Build logs for one deployment. While the deployment is still building the log
 * is re-fetched every few seconds and the view follows the tail — unless the
 * user has scrolled up to read something, in which case it stays put.
 */
export default function LogViewer({ deploymentId, state }) {
  const [lines, setLines] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const bodyRef = useRef(null);
  const pinnedRef = useRef(true);

  const live = state === 'BUILDING' || state === 'QUEUED';

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchJson(`/api/vercel/logs?deploymentId=${encodeURIComponent(deploymentId)}`);
        setLines(data.lines || []);
        setError(null);
      } catch (err) {
        // A failed tail poll should not blow away logs already on screen.
        if (!silent) setError(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [deploymentId],
  );

  useEffect(() => {
    pinnedRef.current = true;
    load();
  }, [load]);

  useEffect(() => {
    if (!live) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load({ silent: true });
    }, TAIL_MS);
    return () => clearInterval(interval);
  }, [live, load]);

  // Follow the tail only while the user is parked at the bottom.
  useEffect(() => {
    if (lines && bodyRef.current && pinnedRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  function onScroll(event) {
    const el = event.currentTarget;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  }

  const visible = useMemo(() => {
    const list = lines || [];
    const needle = filter.trim().toLowerCase();
    return list.filter((line) => {
      if (errorsOnly && line.level !== 'error') return false;
      if (!needle) return true;
      return line.text.toLowerCase().includes(needle);
    });
  }, [lines, filter, errorsOnly]);

  const errorCount = useMemo(() => (lines || []).filter((line) => line.level === 'error').length, [lines]);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText((lines || []).map((line) => line.text).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — not worth interrupting the user for */
    }
  }

  function jumpToEnd() {
    if (!bodyRef.current) return;
    pinnedRef.current = true;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }

  return (
    <div className="log-panel">
      <div className="log-head">
        <span className="panel-title">Build log</span>

        {live ? (
          <span className="topbar-meta" style={{ color: 'var(--building)' }}>
            <span className="live-dot" style={{ background: 'var(--building)' }} aria-hidden="true" />
            live
          </span>
        ) : null}

        <span className="mono faint" style={{ fontSize: 11.5 }}>
          {lines ? `${lines.length} lines` : ''}
          {errorCount ? ` · ${errorCount} error lines` : ''}
        </span>

        <div className="topbar-spacer" />

        <input
          className="input"
          type="search"
          placeholder="Filter log"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter log lines"
        />
        <button
          type="button"
          className="btn btn-sm"
          aria-pressed={errorsOnly}
          onClick={() => setErrorsOnly((value) => !value)}
          style={errorsOnly ? { borderColor: 'var(--error)', color: 'var(--error)' } : undefined}
        >
          Errors only
        </button>
        <button type="button" className="btn btn-sm" onClick={jumpToEnd} disabled={!lines?.length}>
          Jump to end
        </button>
        <button type="button" className="btn btn-sm" onClick={copyAll} disabled={!lines?.length}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }, (_, index) => (
            <Line key={index} width={`${88 - index * 9}%`} height={11} />
          ))}
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: 14 }}>
          <ErrorBanner error={error} onRetry={() => load()} />
        </div>
      ) : null}

      {!loading && !error && lines && lines.length === 0 ? (
        <div style={{ padding: '22px 15px' }} className="muted mono">
          {live
            ? 'Waiting for the first build events...'
            : 'No build events for this deployment. Logs for older deployments may have expired on Vercel.'}
        </div>
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <div className="log-body" ref={bodyRef} onScroll={onScroll} tabIndex={0} aria-label="Build log output">
          {visible.map((line, index) => (
            <div key={line.id} className={cx('log-line', `level-${line.level}`)}>
              <span className="ln" aria-hidden="true">
                {index + 1}
              </span>
              {line.created ? (
                <span className="faint" style={{ flex: 'none' }}>
                  {clockTime(line.created)}
                </span>
              ) : null}
              <span className="lt">{line.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && lines && lines.length > 0 && visible.length === 0 ? (
        <div style={{ padding: '18px 15px' }} className="muted mono">
          No lines match that filter.
        </div>
      ) : null}
    </div>
  );
}
