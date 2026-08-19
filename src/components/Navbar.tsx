'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { NotificationBell, type NotificationItem } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchModal } from '@/components/SearchModal';

interface NavbarProps {
  userName: string;
  notifications: NotificationItem[];
  orgName: string;
}

// orgName is resolved server-side (src/lib/site.ts) and passed in as a prop —
// this is a client component, so it can't read process.env itself.
export function Navbar({ userName, notifications, orgName }: NavbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white print:hidden dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/my-tasks" className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-brand-700 dark:text-brand-300">Asa</span>
          {orgName && (
            <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">
              {orgName}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-4">
          <SearchModal />
          <ThemeToggle />
          <NotificationBell notifications={notifications} />
          <span className="text-sm text-slate-600 dark:text-slate-300">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/sign-in' })}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
