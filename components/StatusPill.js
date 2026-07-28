'use client';

import { cx } from '@/lib/format';

const LABELS = {
  READY: 'Ready',
  BUILDING: 'Building',
  QUEUED: 'Queued',
  ERROR: 'Error',
  CANCELED: 'Canceled',
  NONE: 'No deploys',
};

/** Maps a normalized status onto the four visual treatments. */
export function statusClass(status) {
  if (status === 'READY') return 'is-ready';
  if (status === 'BUILDING' || status === 'QUEUED') return 'is-building';
  if (status === 'ERROR') return 'is-error';
  return 'is-idle';
}

export function statusModifier(status) {
  if (status === 'READY') return 'card--ready';
  if (status === 'BUILDING' || status === 'QUEUED') return 'card--building';
  if (status === 'ERROR') return 'card--error';
  return 'card--idle';
}

export function statusLabel(status) {
  return LABELS[status] || 'Unknown';
}

export default function StatusPill({ status, className }) {
  return (
    <span className={cx('pill', statusClass(status), className)}>
      <span className="dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
