import { ImageResponse } from 'next/og';
import { profile, project } from '@/lib/profile';

export const runtime = 'edge';
export const alt = `${project.name} — ${project.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social card, generated at build time. Uses the app's own palette so a shared
 * link looks like the thing it opens. No external fonts — keeps the build hermetic.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0E1116',
          padding: '72px 80px',
          color: '#E6EBF2',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(145deg, #4C9AFF, #7F5BFF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 5, background: '#0E1116' }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>{project.name}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
            Mission control for
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
            everything you ship.
          </div>
          <div style={{ fontSize: 28, color: '#8A94A6', marginTop: 26, maxWidth: 900 }}>
            Live deploy status, build logs, one-click redeploy, and edit-to-commit for every Vercel project.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, fontSize: 22, color: '#8A94A6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: '#3FB950' }} />
              ready
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: '#D29922' }} />
              building
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: '#F85149' }} />
              error
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 24, color: '#E6EBF2' }}>{profile.name}</div>
            <div style={{ fontSize: 20, color: '#4C9AFF', marginTop: 6 }}>charanreddy.dev</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
