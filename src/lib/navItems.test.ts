import { describe, expect, it } from 'vitest';
import {
  applyNavPreferences,
  buildNavGroups,
  defaultGroupFor,
  defaultOrderOf,
  getVisibleNavDefs,
  NAV_ITEMS,
  DEFAULT_NAV_GROUPS,
} from './navItems';

describe('navItems', () => {
  describe('getVisibleNavDefs', () => {
    it('returns public items for regular user', () => {
      const defs = getVisibleNavDefs({ isAdmin: false, canManageTeams: false });
      const keys = defs.map((d) => d.key);
      expect(keys).toContain('inbox');
      expect(keys).toContain('my-tasks');
      expect(keys).toContain('projects');
      expect(keys).toContain('calendar');
      expect(keys).toContain('org-chart');
      // Admin and team management items should be excluded
      expect(keys).not.toContain('admin-users');
      expect(keys).not.toContain('admin-workflows');
      expect(keys).not.toContain('dashboard');
      expect(keys).not.toContain('teams');
    });

    it('includes team items when canManageTeams is true', () => {
      const defs = getVisibleNavDefs({ isAdmin: false, canManageTeams: true });
      const keys = defs.map((d) => d.key);
      expect(keys).toContain('dashboard');
      expect(keys).toContain('teams');
      expect(keys).not.toContain('admin-users');
    });

    it('includes admin items when isAdmin is true', () => {
      const defs = getVisibleNavDefs({ isAdmin: true, canManageTeams: true });
      const keys = defs.map((d) => d.key);
      expect(keys).toContain('admin-users');
      expect(keys).toContain('admin-workflows');
      expect(keys).toContain('admin-trash');
    });
  });

  describe('defaultGroupFor', () => {
    it('assigns known items to their designated groups', () => {
      expect(defaultGroupFor('inbox').groupName).toBe('Workspace');
      expect(defaultGroupFor('projects').groupName).toBe('Operations');
      expect(defaultGroupFor('org-chart').groupName).toBe('Strategy & Teams');
      expect(defaultGroupFor('admin-users').groupName).toBe('Administration');
    });

    it('falls back to General for unrecognized keys', () => {
      const fallback = defaultGroupFor('custom-item');
      expect(fallback.groupName).toBe('General');
      expect(fallback.groupOrder).toBe(DEFAULT_NAV_GROUPS.length);
    });
  });

  describe('applyNavPreferences', () => {
    it('merges preferences with default items', () => {
      const defs = [
        { key: 'inbox', label: 'Inbox', href: '/inbox' },
        { key: 'my-tasks', label: 'My Tasks', href: '/my-tasks' },
      ];
      const prefs = [
        { itemKey: 'my-tasks', order: 0, hidden: false, groupName: 'Custom Group' },
        { itemKey: 'inbox', order: 1, hidden: true, groupName: 'Custom Group' },
      ];

      const applied = applyNavPreferences(defs, prefs);
      expect(applied[0].key).toBe('my-tasks');
      expect(applied[0].groupName).toBe('Custom Group');
      expect(applied[0].hidden).toBe(false);

      expect(applied[1].key).toBe('inbox');
      expect(applied[1].groupName).toBe('Custom Group');
      expect(applied[1].hidden).toBe(true);
    });
  });

  describe('buildNavGroups', () => {
    it('groups navigation items and respects group order', () => {
      const defs = [
        { key: 'inbox', label: 'Inbox', href: '/inbox' },
        { key: 'projects', label: 'All Projects', href: '/projects' },
        { key: 'org-chart', label: 'Org Chart', href: '/org-chart' },
      ];
      const groups = buildNavGroups(defs, []);
      expect(groups.length).toBeGreaterThanOrEqual(2);
      
      const groupNames = groups.map((g) => g.name);
      expect(groupNames).toContain('Workspace');
      expect(groupNames).toContain('Operations');
      expect(groupNames).toContain('Strategy & Teams');

      const workspaceGroup = groups.find((g) => g.name === 'Workspace');
      expect(workspaceGroup?.items.map((i) => i.key)).toContain('inbox');
    });

    it('allows moving an item to a custom group via preferences', () => {
      const defs = [
        { key: 'inbox', label: 'Inbox', href: '/inbox' },
        { key: 'projects', label: 'All Projects', href: '/projects' },
      ];
      const prefs = [
        { itemKey: 'inbox', order: 0, hidden: false, groupName: 'Custom Group', groupOrder: 0 },
        { itemKey: 'projects', order: 1, hidden: false, groupName: 'Custom Group', groupOrder: 0 },
      ];
      const groups = buildNavGroups(defs, prefs);
      expect(groups.length).toBe(1);
      expect(groups[0].name).toBe('Custom Group');
      expect(groups[0].items.length).toBe(2);
    });
  });
});
