/**
 * Each customer deployment is provisioned in isolation by asa-hq (separate Vercel
 * project + separate database per church), so "which add-on modules a customer
 * bought" is a per-deployment env var, not a database row — there is only ever
 * one tenant reading this at runtime.
 */
export type ModuleKey = 'inventory' | 'meetups' | 'xp' | 'raci';

const ALL_MODULES: ModuleKey[] = ['inventory', 'meetups', 'xp', 'raci'];

function parseEnabledModules(): Set<ModuleKey> {
  // Case-insensitive because a typo here silently withholds a module the
  // customer is paying for, rather than failing loudly.
  const raw = process.env.ENABLED_MODULES?.trim().toLowerCase();
  if (!raw) return new Set();
  if (raw === 'all') return new Set(ALL_MODULES);
  const requested = raw.split(',').map((s) => s.trim());
  return new Set(requested.filter((key): key is ModuleKey => (ALL_MODULES as string[]).includes(key)));
}

let cachedEnabledModules: Set<ModuleKey> | null = null;

export function getEnabledModules(): Set<ModuleKey> {
  if (!cachedEnabledModules) cachedEnabledModules = parseEnabledModules();
  return cachedEnabledModules;
}

export function isModuleEnabled(key: ModuleKey): boolean {
  return getEnabledModules().has(key);
}
