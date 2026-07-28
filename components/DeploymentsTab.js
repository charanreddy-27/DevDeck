'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import StatusPill, { statusClass } from './StatusPill';
import LogViewer from './LogViewer';
import ErrorBanner from './ErrorBanner';
import EmptyState from './EmptyState';
import { RowsSkeleton } from './Skeletons';
import { useToast } from './ToastProvider';
import { fetchJson } from '@/lib/client';
import { cx, formatDuration, relativeTime, shortSha } from '@/lib/format';

const IN_FLIGHT = new Set(['BUILDING', 'QUEUED']);
const LIVE_POLL_MS = 15000;

export default function DeploymentsTab({ projectId, hasRepo, refreshKey, onDeploymentsChange }) {
  const toast = useToast();
  const [deployments, setDeployments] = useState(null);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [redeploying, setRedeploying] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson(`/api/vercel/deployments?projectId=${encodeURIComponent(projectId)}`);
      setDeployments(data.deployments || []);
      setError(null);
      onDeploymentsChange?.(data.deployments || []);
    } catch (err) {
      setError(err);
    }
  }, [projectId, onDeploymentsChange]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const hasInFlight = useMemo(
    () => (deployments || []).some((deployment) => IN_FLIGHT.has(deployment.state)),
    [deployments],
  );

  // While something is building, keep the list fresh without a manual refresh.
  useEffect(() => {
    if (!hasInFlight) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [hasInFlight, load]);

  async function redeploy() {
    setRedeploying(true);
    setConfirming(false);
    try {
      const data = await fetchJson('/api/vercel/redeploy', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
      toast.success(`Production build queued from ${data.deployment?.branch || 'the production branch'}.`, {
        title: 'Redeploying',
      });
      // Vercel needs a moment before the new deployment shows up in the list.
      setTimeout(load, 5000);
    } catch (err) {
      toast.error(err.hint ? `${err.message} ${err.hint}` : err.message);
    } finally {
      setRedeploying(false);
    }
  }

  const loading = deployments === null && !error;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          Deployments
          {deployments ? <span className="muted mono" style={{ fontWeight: 400 }}> · last {deployments.length}</span> : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasInFlight ? (
            <span className="topbar-meta">
              <span className="spinner" aria-hidden="true" />
              build in progress
            </span>
          ) : null}

          {confirming ? (
            <>
              <span className="mono" style={{ fontSize: 12, color: 'var(--building)' }}>
                Redeploy production?
              </span>
              <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={redeploy}>
                Yes, redeploy
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setConfirming(true)}
              disabled={redeploying || !hasRepo}
              title={hasRepo ? 'Rebuild the production branch' : 'This project has no connected GitHub repo'}
            >
              {redeploying ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Queueing
                </>
              ) : (
                'Redeploy production'
              )}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div style={{ padding: 15 }}>
          <ErrorBanner error={error} onRetry={load} />
        </div>
      ) : null}

      {loading ? <RowsSkeleton /> : null}

      {!loading && deployments && deployments.length === 0 ? (
        <EmptyState title="No deployments yet">
          Push to the production branch, or use Redeploy production above to trigger the first build.
        </EmptyState>
      ) : null}

      {!loading && deployments && deployments.length > 0 ? (
        <div className="row-list">
          {deployments.map((deployment) => {
            const open = expandedId === deployment.id;
            return (
              <div key={deployment.id}>
                <button
                  type="button"
                  className="dep-row"
                  aria-expanded={open}
                  onClick={() => setExpandedId(open ? null : deployment.id)}
                >
                  <StatusPill status={deployment.state} />

                  <div className="dep-main">
                    <div className="dep-message">
                      {deployment.commitMessage || <span className="muted">No commit message</span>}
                    </div>
                    <div className="dep-sub">
                      {deployment.branch ? <span className="badge">{deployment.branch}</span> : null}
                      {deployment.commitSha ? <span>{shortSha(deployment.commitSha)}</span> : null}
                      {deployment.author ? <span>{deployment.author}</span> : null}
                      {deployment.target === 'production' ? (
                        <span className="badge badge-prod">production</span>
                      ) : (
                        <span className="badge">{deployment.target}</span>
                      )}
                    </div>
                  </div>

                  <div className="dep-right">
                    {deployment.durationMs ? <span className="faint">{formatDuration(deployment.durationMs)}</span> : null}
                    <span title={deployment.created ? new Date(deployment.created).toLocaleString() : ''}>
                      {relativeTime(deployment.created)}
                    </span>
                    <span className={cx('chevron', open && 'open')} aria-hidden="true">
                      &#9656;
                    </span>
                  </div>
                </button>

                {open ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        padding: '10px 15px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--panel-2)',
                      }}
                    >
                      <span className={`pill ${statusClass(deployment.state)}`}>
                        <span className="dot" aria-hidden="true" />
                        {deployment.id}
                      </span>
                      {deployment.url ? (
                        <a className="link-chip" href={deployment.url} target="_blank" rel="noreferrer">
                          Open this deployment &#8599;
                        </a>
                      ) : null}
                      {deployment.inspectorUrl ? (
                        <a className="link-chip" href={deployment.inspectorUrl} target="_blank" rel="noreferrer">
                          Inspect on Vercel &#8599;
                        </a>
                      ) : null}
                    </div>
                    <LogViewer deploymentId={deployment.id} state={deployment.state} />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
