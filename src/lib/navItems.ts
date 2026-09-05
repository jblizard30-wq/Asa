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
  groupName?: string | null;
  groupOrder?: number | null;
}

export interface NavGroupItem extends NavItemDef {
  order: number;
  hidden: boolean;
  groupName: string;
}

export interface NavGroup {
  name: string;
  order: number;
  items: NavGroupItem[];
}

export const DEFAULT_NAV_GROUPS: { name: string; itemKeys: string[] }[] = [
  {
    name: 'Workspace',
    itemKeys: ['inbox', 'my-tasks', 'personal-tasks', 'calendar'],
  },
  {
    name: 'Operations',
    itemKeys: ['projects', 'inventory', 'meetups', 'raci'],
  },
  {
    name: 'Strategy & Teams',
    itemKeys: ['dashboard', 'teams', 'org-chart', 'xp'],
  },
  {
    name: 'Administration',
    itemKeys: ['admin-users', 'admin-workflows', 'admin-trash', 'trash'],
  },
];

export const NAV_ITEMS: NavItemDef[] = [
  { key: 'inbox', label: 'Inbox', href: '/inbox' },
  { key: 'my-tasks', label: 'My Tasks', href: '/my-tasks' },
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', requires: 'canManageTeams' },
  { key: 'personal-tasks', label: 'Personal Tasks', href: '/personal-tasks' },
  { key: 'projects', label: 'All Projects', href: '/projects' },
  { key: 'calendar', label: 'Calendar', href: '/calendar' },
  { key: 'inventory', label: 'Inventory', href: '/inventory', module: 'inventory' },
  { key: 'meetups', label: 'Meetups', href: '/meetups', module: 'meetups' },
  { key: 'raci', label: 'RACI Charts', href: '/raci', module: 'raci' },
  { key: 'xp', label: 'XP Hub', href: '/xp', module: 'xp' },
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

export function defaultGroupFor(itemKey: string): { groupName: string; groupOrder: number } {
  for (let gIndex = 0; gIndex < DEFAULT_NAV_GROUPS.length; gIndex++) {
    if (DEFAULT_NAV_GROUPS[gIndex].itemKeys.includes(itemKey)) {
      return { groupName: DEFAULT_NAV_GROUPS[gIndex].name, groupOrder: gIndex };
    }
  }
  return { groupName: 'General', groupOrder: DEFAULT_NAV_GROUPS.length };
}

/** Merges the role-filtered nav defs with a user's saved preferences and sorts by effective order. */
export function applyNavPreferences<T extends NavItemDef>(
  defs: T[],
  prefs: NavPreferenceInput[]
): (T & { order: number; hidden: boolean; groupName: string })[] {
  const prefMap = new Map(prefs.map((p) => [p.itemKey, p]));
  return defs
    .map((def, index) => {
      const pref = prefMap.get(def.key);
      const defGroup = defaultGroupFor(def.key);
      const groupName = pref?.groupName || defGroup.groupName;
      return {
        ...def,
        order: pref?.order ?? index,
        hidden: pref?.hidden ?? false,
        groupName,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** Builds collapsible, ordered groups of navigation items for the sidebar. */
export function buildNavGroups<T extends NavItemDef>(
  defs: T[],
  prefs: NavPreferenceInput[]
): NavGroup[] {
  const applied = applyNavPreferences(defs, prefs);
  const prefMap = new Map(prefs.map((p) => [p.itemKey, p]));

  const groupMap = new Map<string, NavGroupItem[]>();
  for (const item of applied) {
    if (!groupMap.has(item.groupName)) {
      groupMap.set(item.groupName, []);
    }
    groupMap.get(item.groupName)!.push(item as NavGroupItem);
  }

  const groups: NavGroup[] = Array.from(groupMap.entries()).map(([name, groupItems]) => {
    groupItems.sort((a, b) => a.order - b.order);
    const firstWithGroupOrder = prefs.find((p) => p.groupName === name && typeof p.groupOrder === 'number');
    const defaultIndex = DEFAULT_NAV_GROUPS.findIndex((g) => g.name === name);
    const order = firstWithGroupOrder?.groupOrder ?? (defaultIndex === -1 ? 999 : defaultIndex);
    return {
      name,
      order,
      items: groupItems,
    };
  });

  groups.sort((a, b) => a.order - b.order);
  return groups;
}
