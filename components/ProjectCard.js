'use client';

import Link from 'next/link';
import StatusPill, { statusModifier } from './StatusPill';
import { OutcomeStrip } from './Insights';
import { cx, hostOf, relativeTime } from '@/lib/format';

export default function ProjectCard({ project, recent }) {
  const repo = project.repo;

  return (
    <article className={cx('card', statusModifier(project.status))}>
      <div className="card-top">
        <Link href={`/project/${encodeURIComponent(project.id)}`} className="card-name">
          {project.name}
        </Link>
        {project.framework ? <span className="badge">{project.framework}</span> : null}
      </div>

      <div className="card-meta">
        {repo ? (
          <span className="repo-line" title={`${repo.owner}/${repo.name}`}>
            <span aria-hidden="true">&#9679;</span>
            <span>
              {repo.owner}/{repo.name}
            </span>
          </span>
        ) : (
          <span className="faint">{project.gitProvider ? `${project.gitProvider} repo` : 'no git repo linked'}</span>
        )}
        {repo?.branch ? <span className="badge">{repo.branch}</span> : null}
      </div>

      {project.commitMessage ? (
        <div className="card-commit" title={project.commitMessage}>
          {project.commitMessage}
        </div>
      ) : null}

      <div className="card-foot">
        <div className="card-status">
          <StatusPill status={project.status} />
          <OutcomeStrip recent={recent} />
        </div>
        <div className="card-meta" style={{ gap: 12 }}>
          <span title={project.lastDeployedAt ? new Date(project.lastDeployedAt).toLocaleString() : ''}>
            {project.lastDeployedAt ? relativeTime(project.lastDeployedAt) : 'never deployed'}
          </span>
          {project.productionUrl ? (
            <a
              className="card-link"
              href={project.productionUrl}
              target="_blank"
              rel="noreferrer"
              title={hostOf(project.productionUrl)}
            >
              Open site &#8599;
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
