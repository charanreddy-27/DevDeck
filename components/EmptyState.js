'use client';

export default function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {typeof children === 'string' ? <p>{children}</p> : children}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}
