import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      <h3>Page not found</h3>
      <p>That route does not exist in DevDeck.</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/">Back to mission control</Link>
      </p>
    </div>
  );
}
