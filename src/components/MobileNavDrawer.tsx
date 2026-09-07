// src/components/MobileNavDrawer.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SETTINGS_NAV_ITEM } from '@/lib/navItems';
import type { SidebarFolder, SidebarNavGroup, SidebarNavItem, SidebarProject } from '@/components/Sidebar';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orgName?: string;
  userName?: string;
  navItems?: SidebarNavItem[];
  navGroups?: SidebarNavGroup[];
  folders?: SidebarFolder[];
  ungroupedProjects?: SidebarProject[];
}

export function MobileNavDrawer({
  isOpen,
  onClose,
  orgName = 'Church Operations',
  userName,
  navItems = [],
  navGroups = [],
  folders = [],
  ungroupedProjects = [],
}: MobileNavDrawerProps) {
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function isActive(href: string) {
    if (href === '/projects') return pathname === '/projects';
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 left-0 flex w-4/5 max-w-xs flex-col bg-white shadow-2xl dark:bg-slate-900 dark:border-r dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-brand-700 dark:text-brand-400">Asa</span>
            {orgName && (
              <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {orgName}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups && navGroups.length > 0 ? (
            <div className="space-y-4">
              {navGroups.map((group) => (
                <div key={group.name} className="space-y-1">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.name}
                  </p>
                  <nav className="space-y-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive(item.href)
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </nav>
                </div>
              ))}
            </div>
          ) : (
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          )}

          {/* Projects & Folders */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800/80">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Projects
            </p>
            <div className="mt-2 space-y-1">
              {folders.map((folder) => (
                <div key={folder.id} className="space-y-1">
                  <p className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    📁 {folder.name}
                  </p>
                  <div className="ml-3 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-800">
                    {folder.projects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        onClick={onClose}
                        className={`block truncate rounded-md px-2 py-1.5 text-xs font-medium ${
                          isActive(`/projects/${p.id}`)
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {ungroupedProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  onClick={onClose}
                  className={`block truncate rounded-md px-2 py-1.5 text-xs font-medium ${
                    isActive(`/projects/${p.id}`)
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800 space-y-2">
          <Link
            href={SETTINGS_NAV_ITEM.href}
            onClick={onClose}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(SETTINGS_NAV_ITEM.href)
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            ⚙️ {SETTINGS_NAV_ITEM.label}
          </Link>

          {userName && (
            <div className="flex items-center justify-between px-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">{userName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

