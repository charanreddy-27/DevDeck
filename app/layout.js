import Link from 'next/link';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import NavLinks from '@/components/NavLinks';
import { profile, project } from '@/lib/profile';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://devdeck.charanreddy.dev';
const TITLE = `${project.name} — ${project.tagline}`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${project.name}`,
  },
  description: project.description,
  applicationName: project.name,
  keywords: [
    'DevDeck',
    'Vercel dashboard',
    'deployment monitoring',
    'Next.js',
    'GitHub API',
    'Vercel API',
    profile.name,
    profile.fullName,
    profile.role,
  ],
  authors: [{ name: profile.fullName, url: profile.url }],
  creator: profile.fullName,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: project.description,
    type: 'website',
    url: SITE_URL,
    siteName: project.name,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: project.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport = {
  themeColor: '#0e1116',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ToastProvider>
          <header className="topbar">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true" />
              DevDeck
            </Link>

            <NavLinks />

            <div className="topbar-spacer" />

            <div className="topbar-meta">
              <a href={profile.url} target="_blank" rel="noreferrer" className="link-chip">
                {profile.firstName.toLowerCase()}reddy.dev &#8599;
              </a>
            </div>
          </header>

          <main className="shell">{children}</main>

          <footer className="site-foot">
            <span className="mono">Crafted with intent.</span>
            <span className="topbar-spacer" />
            <a href={project.repo} target="_blank" rel="noreferrer">
              Source
            </a>
            <a href={profile.url} target="_blank" rel="noreferrer">
              Portfolio
            </a>
            <a href={profile.socials.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
