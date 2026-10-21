'use client';

import { cx, formatDuration } from '@/lib/format';

/**
 * The numbers a person scanning a deploy dashboard actually wants: how much
 * shipped, how much of it worked, how long builds take, and what is building
 * right now. Fed by /api/vercel/activity (the newest 100 deployments across
 * every project, one API call) and the pure aggregation in lib/activity.js.
 */

const MIN_DAYS = 7;

/** Drops leading empty days: 100 deployments may span less than the 14-day window. */
function trimmedDays(byDay) {
  const first = byDay.findIndex((day) => day.total > 0);
  if (first === -1) return byDay.slice(-MIN_DAYS);
  return byDay.slice(Math.min(first, byDay.length - MIN_DAYS));
}

function dayLabel(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function DeployChart({ days }) {
  const peak = Math.max(1, ...days.map((day) => day.total));
  const width = 100 / days.length;
  return (
    <svg className="mini-chart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Deployments per day">
      {days.map((day, index) => {
        const x = index * width + width * 0.18;
        const w = width * 0.64;
        const scale = 38 / peak;
        const ready = day.ready * scale;
        const error = day.error * scale;
        const other = (day.total - day.ready - day.error) * scale;
        let y = 40;
        const parts = [];
        for (const [height, cls] of [[ready, 'seg-ready'], [error, 'seg-error'], [other, 'seg-other']]) {
          if (height <= 0) continue;
          y -= height;
          parts.push(<rect key={cls} className={cls} x={x} y={y} width={w} height={height} rx="0.6" />);
        }
        return (
          <g key={day.date}>
            <title>{`${dayLabel(day.date)}: ${day.total} deploys · ${day.ready} ready · ${day.error} failed`}</title>
            <rect className="seg-hit" x={index * width} y="0" width={width} height="40" />
            {day.total ? parts : <rect className="seg-empty" x={x} y="38.6" width={w} height="1.4" />}
          </g>
        );
      })}
    </svg>
  );
}

export function InsightsStrip({ activity, projects }) {
  const summary = activity?.summary;
  if (!summary) {
    return (
      <section className="insights" aria-label="Deploy insights" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="insight is-loading">
            <div className="skeleton" style={{ height: 10, width: '45%' }} />
            <div className="skeleton" style={{ height: 22, width: '35%', marginTop: 12 }} />
          </div>
        ))}
      </section>
    );
  }

  const days = trimmedDays(summary.byDay || []);
  const inWindow = days.reduce((sum, day) => sum + day.total, 0);
  const failedInWindow = days.reduce((sum, day) => sum + day.error, 0);
  const rate = summary.successRate;
  const building = (projects || []).filter((p) => p.status === 'BUILDING' || p.status === 'QUEUED');

  return (
    <section className="insights" aria-label="Deploy insights">
      <div className="insight insight-wide">
        <div className="insight-head">
          <span className="insight-label">Deploys · last {days.length} days</span>
          <span className="insight-legend">
            <i className="seg-ready" /> ready <i className="seg-error" /> failed
          </span>
        </div>
        <div className="insight-row">
          <div>
            <div className="insight-value">{inWindow}</div>
            <div className="insight-sub">{(inWindow / days.length).toFixed(1)} a day</div>
          </div>
          <DeployChart days={days} />
        </div>
      </div>

      <div className="insight">
        <span className="insight-label">Success rate</span>
        <div className={cx('insight-value', rate !== null && rate < 0.9 && 'is-warn')}>
          {rate === null ? '—' : `${Math.round(rate * 100)}%`}
        </div>
        <div className="meter" aria-hidden="true">
          <i style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
        </div>
        <div className="insight-sub">
          {failedInWindow} failed build{failedInWindow === 1 ? '' : 's'} in {days.length} days
        </div>
      </div>

      <div className="insight">
        <span className="insight-label">Median build</span>
        <div className="insight-value">{formatDuration(summary.medianBuildMs) || '—'}</div>
        <div className="insight-sub">successful builds, all projects</div>
      </div>

      <div className="insight">
        <span className="insight-label">In flight</span>
        <div className="insight-value">
          {building.length ? <span className="live-dot is-building" aria-hidden="true" /> : null}
          {building.length}
        </div>
        <div className="insight-sub" title={building.map((p) => p.name).join(', ')}>
          {building.length ? building.map((p) => p.name).join(', ') : 'nothing building'}
        </div>
      </div>
    </section>
  );
}

/** A project's last deploy outcomes, oldest → newest, as a strip of ticks. */
export function OutcomeStrip({ recent }) {
  if (!recent?.length) return null;
  const ordered = recent.slice().reverse();
  const ok = ordered.filter((state) => state === 'READY').length;
  return (
    <span className="outcomes" role="img" aria-label={`Last ${ordered.length} deploys: ${ok} ready`} title={`Last ${ordered.length} deploys, oldest → newest`}>
      {ordered.map((state, index) => (
        <i key={index} className={`o-${String(state).toLowerCase()}`} />
      ))}
    </span>
  );
}

/** Project page: success rate, median build, and every build's duration as a bar. */
export function DeploymentStats({ deployments }) {
  const list = deployments || [];
  if (!list.length) return null;
  const finished = list.filter((d) => d.state === 'READY' || d.state === 'ERROR');
  const ready = finished.filter((d) => d.state === 'READY');
  const rate = finished.length ? ready.length / finished.length : null;
  const durations = ready.map((d) => d.durationMs).filter(Boolean).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  const ordered = list.slice().reverse();
  const peak = Math.max(1, ...ordered.map((d) => d.durationMs || 0));
  const production = list.filter((d) => d.target === 'production').length;

  return (
    <div className="dep-stats">
      <div className="dep-stat">
        <span className="insight-label">Success</span>
        <b>{rate === null ? '—' : `${Math.round(rate * 100)}%`}</b>
        <span className="insight-sub">
          {ready.length}/{finished.length} finished builds
        </span>
      </div>
      <div className="dep-stat">
        <span className="insight-label">Median build</span>
        <b>{formatDuration(median) || '—'}</b>
        <span className="insight-sub">{production} production · {list.length - production} preview</span>
      </div>
      <div className="dep-stat dep-stat-chart">
        <span className="insight-label">Build time, last {ordered.length} (oldest → newest)</span>
        <svg className="mini-chart" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="Build duration per deployment">
          {ordered.map((d, index) => {
            const width = 100 / ordered.length;
            const height = d.durationMs ? Math.max(2, (d.durationMs / peak) * 30) : 2;
            const cls = d.state === 'READY' ? 'seg-ready' : d.state === 'ERROR' ? 'seg-error' : d.state === 'BUILDING' || d.state === 'QUEUED' ? 'seg-building' : 'seg-other';
            return (
              <g key={d.id}>
                <title>{`${d.commitMessage || d.id} · ${d.state.toLowerCase()}${d.durationMs ? ` · ${formatDuration(d.durationMs)}` : ''}`}</title>
                <rect className={cls} x={index * width + width * 0.15} y={32 - height} width={width * 0.7} height={height} rx="0.6" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
