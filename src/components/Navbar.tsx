'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { NotificationBell, type NotificationItem } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchModal } from '@/components/SearchModal';
import { MobileNavDrawer } from '@/components/MobileNavDrawer';
import type { SidebarFolder, SidebarNavGroup, SidebarNavItem, SidebarProject } from '@/components/Sidebar';

interface NavbarProps {
  userName: string;
  notifications: NotificationItem[];
  orgName: string;
  folders?: SidebarFolder[];
  ungroupedProjects?: SidebarProject[];
  navItems?: SidebarNavItem[];
  navGroups?: SidebarNavGroup[];
}

// orgName is resolved server-side (src/lib/site.ts) and passed in as a prop —
// this is a client component, so it can't read process.env itself.
export function Navbar({
  userName,
  notifications,
  orgName,
  folders = [],
  ungroupedProjects = [],
  navItems = [],
  navGroups = [],
}: NavbarProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <>
      <header className="border-b border-slate-200 bg-white print:hidden dark:border-slate-800 dark:bg-slate-900 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:hidden transition-colors"
              aria-label="Open navigation menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/my-tasks" className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-brand-700 dark:text-brand-300">Asa</span>
              {orgName && (
                <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">
                  {orgName}
                </span>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <SearchModal />
            <ThemeToggle />
            <NotificationBell notifications={notifications} />
            <span className="hidden sm:inline text-sm text-slate-600 dark:text-slate-300">{userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-over drawer */}
      <MobileNavDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        orgName={orgName}
        userName={userName}
        folders={folders}
        ungroupedProjects={ungroupedProjects}
        navItems={navItems}
        navGroups={navGroups}
      />
    </>
  );
}
