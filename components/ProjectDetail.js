'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import StatusPill from './StatusPill';
import DeploymentsTab from './DeploymentsTab';
import CodeTab from './CodeTab';
import CommitsTab from './CommitsTab';
import SetupGuide from './SetupGuide';
import ErrorBanner from './ErrorBanner';
import EmptyState from './EmptyState';
import { Line } from './Skeletons';
import { fetchJson, isTokenProblem } from '@/lib/client';
import { hostOf, relativeTime, vercelProjectUrl } from '@/lib/format';

const TABS = [
  { key: 'deployments', label: 'Deployments' },
  { key: 'code', label: 'Code' },
  { key: 'commits', label: 'Commits' },
];

const IN_FLIGHT = new Set(['BUILDING', 'QUEUED']);

export default function ProjectDetail({ projectId }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('deployments');
  // Tabs mount on first visit and stay mounted, so an in-progress edit survives
  // a trip to the Deployments tab and the deployment poll keeps running.
  const [visited, setVisited] = useState({ deployments: true });
  const [refreshKey, setRefreshKey] = useState(0);
  const [deployments, setDeployments] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchJson(`/api/vercel/projects?id=${encodeURIComponent(projectId)}`);
      setProject(data.project);
    } catch (err) {
      setError(err);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (project?.name) document.title = `${project.name} — DevDeck`;
  }, [project?.name]);

  function openTab(key) {
    setTab(key);
    setVisited((current) => (current[key] ? current : { ...current, [key]: true }));
  }

  const buildingCount = useMemo(
    () => deployments.filter((deployment) => IN_FLIGHT.has(deployment.state)).length,
    [deployments],
  );

  // Vercel does not expose a project dashboard URL, but it can be derived from
  // any deployment's inspector URL.
  const dashboardUrl = useMemo(() => {
    const withInspector = deployments.find((deployment) => deployment.inspectorUrl);
    return withInspector ? vercelProjectUrl(withInspector.inspectorUrl) : null;
  }, [deployments]);

  // After a commit the deployment list refetches, but the user stays in the
  // editor — losing their place in a large repo is worse than a manual click.
  const afterCommit = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  if (error && isTokenProblem(error)) return <SetupGuide error={error} />;

  if (error) {
    return (
      <>
        <Link href="/" className="back-link">
          &#8592; All projects
        </Link>
        <ErrorBanner error={error} onRetry={load} />
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Link href="/" className="back-link">
          &#8592; All projects
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <Line width="240px" height={26} />
          <Line width="380px" height={12} />
        </div>
        <div className="panel">
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 6 }, (_, index) => (
              <Line key={index} width={`${85 - index * 8}%`} height={13} />
            ))}
          </div>
        </div>
      </>
    );
  }

  const repo = project.repo;

  const noRepoState = (message) => (
    <div className="panel">
      <EmptyState title="No GitHub repository linked">
        <p>{message}</p>
      </EmptyState>
    </div>
  );

  return (
    <>
      <Link href="/" className="back-link">
        &#8592; All projects
      </Link>

      <div className="detail-head">
        <div style={{ minWidth: 0 }}>
          <div className="detail-title-row">
            <h1 className="page-title">{project.name}</h1>
            <StatusPill status={project.status} />
            {project.framework ? <span className="badge">{project.framework}</span> : null}
          </div>

          <div className="detail-links">
            {project.productionUrl ? (
              <a className="link-chip" href={project.productionUrl} target="_blank" rel="noreferrer">
                {hostOf(project.productionUrl)} &#8599;
              </a>
            ) : null}
            {repo ? (
              <a className="link-chip" href={repo.url} target="_blank" rel="noreferrer">
                {repo.owner}/{repo.name} &#8599;
              </a>
            ) : null}
            {repo ? <span className="link-chip">branch {repo.branch}</span> : null}
            <a
              className="link-chip"
              href={dashboardUrl || 'https://vercel.com/dashboard'}
              target="_blank"
              rel="noreferrer"
            >
              Vercel dashboard &#8599;
            </a>
            <span className="link-chip">
              deployed {project.lastDeployedAt ? relativeTime(project.lastDeployedAt) : 'never'}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Project sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === item.key}
            onClick={() => openTab(item.key)}
          >
            {item.label}
            {item.key === 'deployments' && buildingCount > 0 ? (
              <span className="tab-count" title={`${buildingCount} build in progress`}>
                <span className="pill is-building" style={{ padding: '1px 6px' }}>
                  <span className="dot" aria-hidden="true" />
                  {buildingCount}
                </span>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {visited.deployments ? (
        <div hidden={tab !== 'deployments'}>
          <DeploymentsTab
            projectId={project.id}
            hasRepo={Boolean(repo)}
            refreshKey={refreshKey}
            onDeploymentsChange={setDeployments}
          />
        </div>
      ) : null}

      {visited.code ? (
        <div hidden={tab !== 'code'}>
          {repo
            ? <CodeTab repo={repo} onCommitted={afterCommit} />
            : noRepoState(
                project.gitProvider
                  ? `This project is connected to ${project.gitProvider}, which DevDeck cannot edit. Only GitHub repositories are supported.`
                  : 'Connect a GitHub repository to this project in Vercel to browse and edit its files here.',
              )}
        </div>
      ) : null}

      {visited.commits ? (
        <div hidden={tab !== 'commits'}>
          {repo
            ? <CommitsTab repo={repo} refreshKey={refreshKey} />
            : noRepoState('Commit history comes from GitHub. Link a GitHub repo in Vercel to see it here.')}
        </div>
      ) : null}
    </>
  );
}
