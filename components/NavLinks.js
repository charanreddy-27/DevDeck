'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/about-project', label: 'The build' },
  { href: '/about', label: 'About' },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="topnav" aria-label="Primary">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className="topnav-link" aria-current={active ? 'page' : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
