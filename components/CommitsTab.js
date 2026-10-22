'use client';

import { useCallback, useEffect, useState } from 'react';
import ErrorBanner from './ErrorBanner';
import EmptyState from './EmptyState';
import { RowsSkeleton } from './Skeletons';
import { fetchJson } from '@/lib/client';
import { relativeTime, shortSha } from '@/lib/format';

export default function CommitsTab({ repo, refreshKey }) {
  const [commits, setCommits] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ owner: repo.owner, repo: repo.name, per_page: '10' });
    return fetchJson(`/api/github/commits?${params.toString()}`).then(
      (data) => {
        setCommits(data.commits || []);
        setError(null);
      },
      (err) => setError(err),
    );
  }, [repo.owner, repo.name]);

  function retry() {
    setError(null);
    load();
  }

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          Recent commits
          <span className="muted mono" style={{ fontWeight: 400 }}>
            {' '}
            · {repo.owner}/{repo.name}
          </span>
        </div>
        <a className="link-chip" href={repo.url} target="_blank" rel="noreferrer">
          Open repo &#8599;
        </a>
      </div>

      {error ? (
        <div style={{ padding: 15 }}>
          <ErrorBanner error={error} onRetry={retry} />
        </div>
      ) : null}

      {!commits && !error ? <RowsSkeleton count={5} /> : null}

      {commits && commits.length === 0 ? <EmptyState title="No commits yet">This repository is empty.</EmptyState> : null}

      {commits && commits.length > 0 ? (
        <div className="row-list">
          {commits.map((commit) => (
            <div key={commit.sha} className="commit-row">
              {commit.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src={commit.avatar} alt="" width={26} height={26} />
              ) : (
                <span className="avatar" aria-hidden="true" />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dep-message">{commit.message || 'No message'}</div>
                <div className="dep-sub">
                  {commit.author ? <span>{commit.author}</span> : null}
                  <span>{relativeTime(commit.date)}</span>
                </div>
              </div>

              <a className="badge" href={commit.url} target="_blank" rel="noreferrer" title="View commit on GitHub">
                {shortSha(commit.sha)}
              </a>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
