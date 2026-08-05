'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SETTINGS_LINKS = [
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/developer', label: 'Developer' },
  { href: '/settings/navigation', label: 'Navigation' },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto sm:w-48 sm:shrink-0 sm:flex-col sm:overflow-visible">
      {SETTINGS_LINKS.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
              active
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
