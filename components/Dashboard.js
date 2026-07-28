'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProjectCard from './ProjectCard';
import SetupGuide from './SetupGuide';
import ErrorBanner from './ErrorBanner';
import EmptyState from './EmptyState';
import { GridSkeleton } from './Skeletons';
import { fetchJson, isTokenProblem } from '@/lib/client';
import { relativeTime } from '@/lib/format';

const POLL_MS = 30000;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'READY', label: 'Ready' },
  { key: 'BUILDING', label: 'Building' },
  { key: 'ERROR', label: 'Error' },
];

export default function Dashboard() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [, setTick] = useState(0);
  const searchRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    try {
      const data = await fetchJson('/api/vercel/projects');
      setProjects(data.projects || []);
      setFetchedAt(data.fetchedAt || Date.now());
      setError(null);
    } catch (err) {
      setError(err);
      // Keep the last good data on screen when a background poll fails.
      if (!silent) setProjects(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Initial load + 30s poll. Skips polling while the tab is hidden.
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load({ silent: true });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // Keeps "updated Xs ago" honest between polls.
  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // "/" focuses search.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const counts = useMemo(() => {
    const list = projects || [];
    return {
      total: list.length,
      READY: list.filter((p) => p.status === 'READY').length,
      BUILDING: list.filter((p) => p.status === 'BUILDING' || p.status === 'QUEUED').length,
      ERROR: list.filter((p) => p.status === 'ERROR').length,
    };
  }, [projects]);

  const visible = useMemo(() => {
    const list = projects || [];
    const needle = query.trim().toLowerCase();

    return list.filter((project) => {
      if (filter === 'READY' && project.status !== 'READY') return false;
      if (filter === 'BUILDING' && project.status !== 'BUILDING' && project.status !== 'QUEUED') return false;
      if (filter === 'ERROR' && project.status !== 'ERROR') return false;
      if (!needle) return true;

      const haystack = [
        project.name,
        project.framework,
        project.repo ? `${project.repo.owner}/${project.repo.name}` : '',
        project.commitMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [projects, query, filter]);

  if (error && isTokenProblem(error) && !projects) {
    return <SetupGuide error={error} />;
  }

  const loading = projects === null && !error;

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="page-title">Mission control</h1>
          <div className="page-sub">
            Every Vercel project, live. Status refreshes every 30 seconds.
          </div>
        </div>

        <div className="summary-strip">
          {FILTERS.map((item) => {
            const count = item.key === 'all' ? counts.total : counts[item.key];
            return (
              <button
                key={item.key}
                type="button"
                className="summary-chip"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.key !== 'all' ? (
                  <span
                    className="dot"
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background:
                        item.key === 'READY'
                          ? 'var(--ready)'
                          : item.key === 'BUILDING'
                            ? 'var(--building)'
                            : 'var(--error)',
                    }}
                  />
                ) : null}
                {item.label}
                <span className="count">{projects ? count : '—'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && !isTokenProblem(error) ? <ErrorBanner error={error} onRetry={() => load()} /> : null}

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon" aria-hidden="true">
            &#8981;
          </span>
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Filter projects, repos, commits"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter projects"
          />
          {query ? null : (
            <span className="search-kbd">
              <kbd>/</kbd>
            </span>
          )}
        </div>

        <div className="topbar-spacer" />

        <span className="topbar-meta">
          {refreshing ? (
            <>
              <span className="spinner" aria-hidden="true" />
              syncing
            </>
          ) : fetchedAt ? (
            <>
              <span className="live-dot" aria-hidden="true" />
              updated {relativeTime(fetchedAt)}
            </>
          ) : null}
        </span>

        <button type="button" className="btn btn-sm" onClick={() => load({ silent: true })} disabled={refreshing}>
          Refresh
        </button>
      </div>

      {loading ? <GridSkeleton /> : null}

      {!loading && visible.length > 0 ? (
        <div className="grid">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : null}

      {!loading && projects && projects.length === 0 ? (
        <EmptyState title="No projects found">
          <p>
            This Vercel token can see zero projects. If your projects live under a team, add{' '}
            <code className="mono">VERCEL_TEAM_ID</code> to <code className="mono">.env.local</code> and restart the dev
            server.
          </p>
        </EmptyState>
      ) : null}

      {!loading && projects && projects.length > 0 && visible.length === 0 ? (
        <EmptyState title="Nothing matches that filter">
          <p>
            {query ? `No project matches "${query}".` : 'No project has that status right now.'}
          </p>
        </EmptyState>
      ) : null}
    </>
  );
}
