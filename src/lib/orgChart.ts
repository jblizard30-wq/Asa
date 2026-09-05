export interface OrgPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  managerId: string | null;
}

export interface OrgNode {
  id: string;
  name: string;
  email: string;
  role: string;
  children: OrgNode[];
}

/**
 * Builds a forest of reporting trees from a flat list of people.
 * Anyone with no manager (or a manager not in the list) becomes a root.
 * Defends against corrupted data (a reporting cycle) by cutting the cycle
 * open rather than recursing forever.
 */
export function buildOrgTree(people: OrgPerson[]): OrgNode[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenOf = new Map<string, OrgPerson[]>();

  for (const person of people) {
    if (person.managerId && byId.has(person.managerId)) {
      const list = childrenOf.get(person.managerId) ?? [];
      list.push(person);
      childrenOf.set(person.managerId, list);
    }
  }

  const trueRoots = people.filter((p) => !p.managerId || !byId.has(p.managerId));

  const reachable = new Set<string>();
  function markReachable(id: string) {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const child of childrenOf.get(id) ?? []) markReachable(child.id);
  }
  trueRoots.forEach((root) => markReachable(root.id));

  const cycleEntryPoints = people.filter((p) => !reachable.has(p.id));

  function toNode(person: OrgPerson, visiting: Set<string>): OrgNode {
    const base = { id: person.id, name: person.name, email: person.email, role: person.role };
    if (visiting.has(person.id)) return { ...base, children: [] };
    const nextVisiting = new Set(visiting).add(person.id);
    const children = (childrenOf.get(person.id) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((child) => toNode(child, nextVisiting));
    return { ...base, children };
  }

  return [...trueRoots, ...cycleEntryPoints]
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => toNode(person, new Set()));
}

/** Every id in the subtree rooted at `node`, including `node.id` itself. */
export function collectDescendantIds(node: OrgNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectDescendantIds(child)) ids.add(id);
  }
  return ids;
}

/** Traces the ancestry path from the highest root down to the user's immediate manager. */
export function getAncestorChain(people: OrgPerson[], userId: string): OrgPerson[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const chain: OrgPerson[] = [];
  let current = byId.get(userId);
  const visited = new Set<string>();

  while (current && current.managerId && byId.has(current.managerId)) {
    if (visited.has(current.managerId)) break; // cycle protection
    visited.add(current.managerId);
    const manager = byId.get(current.managerId)!;
    chain.unshift(manager); // root first, direct manager last
    current = manager;
  }

  return chain;
}

/** Locates an OrgNode anywhere within the tree forest. */
export function findNodeInForest(roots: OrgNode[], targetId: string): OrgNode | null {
  for (const root of roots) {
    if (root.id === targetId) return root;
    const found = findNodeInForest(root.children, targetId);
    if (found) return found;
  }
  return null;
}

/** Returns the IDs of all immediate direct reports of the specified user. */
export function getDirectReportIds(people: OrgPerson[], userId: string): string[] {
  return people.filter((p) => p.managerId === userId).map((p) => p.id);
}
