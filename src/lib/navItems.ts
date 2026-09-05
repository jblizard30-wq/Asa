import { isModuleEnabled, type ModuleKey } from './modules';

export interface NavItemDef {
  key: string;
  label: string;
  href: string;
  requires?: 'admin' | 'canManageTeams';
  module?: ModuleKey;
  keywords?: string[];
}

export interface RoleFlags {
  isAdmin: boolean;
  canManageTeams: boolean;
}

export interface NavPreferenceInput {
  itemKey: string;
  order: number;
  hidden: boolean;
}

export const NAV_ITEMS: NavItemDef[] = [
  { key: 'inbox', label: 'Inbox', href: '/inbox' },
  { key: 'my-tasks', label: 'My Tasks', href: '/my-tasks' },
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', requires: 'canManageTeams' },
  { key: 'personal-tasks', label: 'Personal Tasks', href: '/personal-tasks' },
  { key: 'projects', label: 'All Projects', href: '/projects' },
  { key: 'calendar', label: 'Calendar', href: '/calendar' },
  { key: 'inventory', label: 'Inventory', href: '/inventory', module: 'inventory' },
  { key: 'trash', label: 'Trash', href: '/trash' },
  { key: 'org-chart', label: 'Org Chart', href: '/org-chart' },
  { key: 'teams', label: 'Teams', href: '/teams', requires: 'canManageTeams' },
  { key: 'admin-users', label: 'User Management', href: '/admin/users', requires: 'admin' },
  { key: 'admin-trash', label: 'All Trash', href: '/admin/trash', requires: 'admin' },
  { key: 'admin-workflows', label: 'Workflows', href: '/admin/workflows', requires: 'admin' },
];

/** Always shown at the bottom of the sidebar — not reorderable or hideable, so users always have a way back in. */
export const SETTINGS_NAV_ITEM: NavItemDef = {
  key: 'settings',
  label: 'Settings',
  href: '/settings',
  keywords: ['navigation', 'sidebar', 'rearrange', 'reorder', 'hide', 'show', 'preferences', 'customize'],
};

export function getVisibleNavDefs(role: RoleFlags): NavItemDef[] {
  return NAV_ITEMS.filter((item) => {
    if (item.module && !isModuleEnabled(item.module)) return false;
    if (item.requires === 'admin') return role.isAdmin;
    if (item.requires === 'canManageTeams') return role.canManageTeams;
    return true;
  });
}

export function defaultOrderOf(itemKey: string): number {
  const index = NAV_ITEMS.findIndex((item) => item.key === itemKey);
  return index === -1 ? NAV_ITEMS.length : index;
}

/** Merges the role-filtered nav defs with a user's saved preferences and sorts by effective order. */
export function applyNavPreferences<T extends NavItemDef>(
  defs: T[],
  prefs: NavPreferenceInput[]
): (T & { order: number; hidden: boolean })[] {
  const prefMap = new Map(prefs.map((p) => [p.itemKey, p]));
  return defs
    .map((def, index) => {
      const pref = prefMap.get(def.key);
      return { ...def, order: pref?.order ?? index, hidden: pref?.hidden ?? false };
    })
    .sort((a, b) => a.order - b.order);
}
