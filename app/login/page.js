import { connection } from 'next/server';
import LoginForm from '@/components/LoginForm';
import { isGateEnabled, safeNextPath } from '@/lib/auth/gate';

export const metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/**
 * Server-rendered so whether the gate is on is decided by this deployment's
 * env at request time — connection() keeps it from being baked in at build.
 * searchParams is a Promise in Next.js 15+.
 */
export default async function LoginPage({ searchParams }) {
  await connection();
  const params = await searchParams;
  const next = safeNextPath(typeof params?.next === 'string' ? params.next : '/');
  const error = typeof params?.error === 'string' ? params.error : null;

  return <LoginForm enabled={isGateEnabled()} next={next} initialError={error} />;
}
