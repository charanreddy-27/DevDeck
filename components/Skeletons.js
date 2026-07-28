'use client';

export function Line({ width = '100%', height = 12, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function CardSkeleton() {
  return (
    <div className="card card--idle" aria-hidden="true">
      <div className="card-top">
        <Line width="52%" height={16} />
        <Line width="64px" height={18} />
      </div>
      <Line width="40%" height={11} />
      <Line width="80%" height={11} />
      <div className="card-foot">
        <Line width="86px" height={18} />
        <Line width="66px" height={11} />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 6 }) {
  return (
    <div className="row-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="dep-row" style={{ cursor: 'default' }}>
          <Line width="76px" height={18} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Line width={`${45 + ((index * 13) % 40)}%`} height={12} />
            <Line width="180px" height={10} />
          </div>
          <Line width="52px" height={10} />
        </div>
      ))}
    </div>
  );
}
