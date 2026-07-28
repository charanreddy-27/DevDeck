'use client';

export default function ErrorBanner({ error, onRetry, tone = 'error' }) {
  if (!error) return null;

  return (
    <div className={`banner${tone === 'warn' ? ' banner-warn' : ''}`}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="banner-title">{error.message || 'Something went wrong.'}</div>
        {error.hint ? <div className="banner-hint">{error.hint}</div> : null}
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
