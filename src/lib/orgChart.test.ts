import { describe, expect, it } from 'vitest';
import {
  buildOrgTree,
  collectDescendantIds,
  getAncestorChain,
  findNodeInForest,
  getDirectReportIds,
  type OrgPerson,
} from './orgChart';

describe('orgChart utilities', () => {
  const samplePeople: OrgPerson[] = [
    { id: 'u1', name: 'Lead Pastor', email: 'lead@cpc.org', role: 'ADMIN', managerId: null },
    { id: 'u2', name: 'Executive Pastor', email: 'exec@cpc.org', role: 'ADMIN', managerId: 'u1' },
    { id: 'u3', name: 'Worship Director', email: 'worship@cpc.org', role: 'TEAM_LEAD', managerId: 'u2' },
    { id: 'u4', name: 'Youth Director', email: 'youth@cpc.org', role: 'TEAM_LEAD', managerId: 'u2' },
    { id: 'u5', name: 'AV Tech', email: 'av@cpc.org', role: 'MEMBER', managerId: 'u3' },
    { id: 'u6', name: 'Solo Contractor', email: 'contractor@cpc.org', role: 'MEMBER', managerId: null },
  ];

  describe('buildOrgTree', () => {
    it('creates hierarchy with roots and children sorted by name', () => {
      const forest = buildOrgTree(samplePeople);
      expect(forest.length).toBe(2); // Lead Pastor and Solo Contractor

      const lead = forest.find((n) => n.id === 'u1')!;
      expect(lead).toBeDefined();
      expect(lead.children.length).toBe(1);
      expect(lead.children[0].id).toBe('u2');

      const exec = lead.children[0];
      expect(exec.children.length).toBe(2);
      expect(exec.children.map((c) => c.id)).toEqual(['u3', 'u4']); // 'Worship Director' (u3) before 'Youth Director' (u4)
    });

    it('handles cyclic manager references gracefully without infinite loop', () => {
      const cyclicPeople: OrgPerson[] = [
        { id: 'c1', name: 'Cycle A', email: 'a@cpc.org', role: 'ADMIN', managerId: 'c2' },
        { id: 'c2', name: 'Cycle B', email: 'b@cpc.org', role: 'ADMIN', managerId: 'c1' },
      ];
      const forest = buildOrgTree(cyclicPeople);
      expect(forest.length).toBeGreaterThan(0);
      expect(forest[0].children.length).toBeLessThanOrEqual(1);
    });
  });

  describe('collectDescendantIds', () => {
    it('collects all descendants in the subtree including the node itself', () => {
      const forest = buildOrgTree(samplePeople);
      const lead = forest.find((n) => n.id === 'u1')!;
      const descendants = collectDescendantIds(lead);

      expect(descendants.has('u1')).toBe(true);
      expect(descendants.has('u2')).toBe(true);
      expect(descendants.has('u3')).toBe(true);
      expect(descendants.has('u4')).toBe(true);
      expect(descendants.has('u5')).toBe(true);
      expect(descendants.has('u6')).toBe(false); // separate tree
    });
  });

  describe('getAncestorChain', () => {
    it('returns empty array if user has no manager', () => {
      const chain = getAncestorChain(samplePeople, 'u1');
      expect(chain).toEqual([]);
    });

    it('returns the supervisor chain ordered from top root to immediate manager', () => {
      const chain = getAncestorChain(samplePeople, 'u5'); // AV Tech -> Worship Director -> Exec Pastor -> Lead Pastor
      expect(chain.map((p) => p.id)).toEqual(['u1', 'u2', 'u3']);
    });

    it('guards against cycles', () => {
      const cyclicPeople: OrgPerson[] = [
        { id: 'c1', name: 'Cycle A', email: 'a@cpc.org', role: 'ADMIN', managerId: 'c2' },
        { id: 'c2', name: 'Cycle B', email: 'b@cpc.org', role: 'ADMIN', managerId: 'c1' },
      ];
      const chain = getAncestorChain(cyclicPeople, 'c1');
      expect(chain.length).toBeLessThanOrEqual(2);
    });
  });

  describe('findNodeInForest', () => {
    it('locates a node anywhere within the forest', () => {
      const forest = buildOrgTree(samplePeople);
      const found = findNodeInForest(forest, 'u5');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('AV Tech');
    });

    it('returns null if node is not found', () => {
      const forest = buildOrgTree(samplePeople);
      const found = findNodeInForest(forest, 'non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getDirectReportIds', () => {
    it('returns only immediate children ids', () => {
      const reports = getDirectReportIds(samplePeople, 'u2');
      expect(reports).toContain('u3');
      expect(reports).toContain('u4');
      expect(reports).not.toContain('u5'); // grandchild
      expect(reports.length).toBe(2);
    });

    it('returns empty array if person has no reports', () => {
      const reports = getDirectReportIds(samplePeople, 'u5');
      expect(reports).toEqual([]);
    });
  });
});
