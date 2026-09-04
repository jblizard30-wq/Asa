'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PackageIcon, ShoppingCartIcon, TruckIcon, SettingsIcon } from '@/components/InventoryIcons';

export function InventoryNav({ canManage }: { canManage: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: '/inventory', label: 'Inventory Hub', icon: PackageIcon, exact: true },
    { href: '/inventory/orders', label: 'Restock Orders', icon: ShoppingCartIcon, exact: false },
    { href: '/inventory/vendors', label: 'Vendors', icon: TruckIcon, exact: false },
    ...(canManage
      ? [{ href: '/inventory/settings', label: 'Catalog & Settings', icon: SettingsIcon, exact: false }]
      : []),
  ];

  const isLinkActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <nav className="-mb-px flex space-x-6 overflow-x-auto">
        {links.map((link) => {
          const active = isLinkActive(link.href, link.exact);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
