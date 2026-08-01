'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { NotificationBell, type NotificationItem } from '@/components/NotificationBell';

interface NavbarProps {
  userName: string;
  notifications: NotificationItem[];
}

const links = [
  { href: '/my-tasks', label: 'My Tasks' },
  { href: '/projects', label: 'Projects' },
];

export function Navbar({ userName, notifications }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/my-tasks" className="text-base font-semibold text-brand-700">
            Church Tasks
          </Link>
          <nav className="flex gap-1">
            {links.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell notifications={notifications} />
          <span className="text-sm text-slate-600">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/sign-in' })}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
