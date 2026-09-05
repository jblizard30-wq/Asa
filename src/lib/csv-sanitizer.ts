/**
 * Reusable utility to clean, sanitize, and normalize raw inventory CSV spreadsheets.
 * Handles messy headers, embedded business logic in titles, duplicate vendor spellings,
 * contact detail extraction, unit normalization, and string-to-number parsing.
 */

export interface SanitizedVendor {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  url?: string;
}

export interface SanitizedItemRecord {
  buildingName: string;
  roomName: string;
  itemName: string;
  idealQty: number;
  onHandQty: number;
  reorderThreshold: number;
  unit: string;
  vendorName: string | null;
  vendorDetails?: SanitizedVendor;
  notes?: string;
  inventoryCategory: 'consumables' | 'liturgical' | 'office' | 'kids' | 'facilities';
}

// Vendor aliases and contact directory
export const VENDOR_DIRECTORY: Record<string, SanitizedVendor> = {
  'the bean doctor': {
    name: 'The Bean Doctor',
    contactPerson: 'Chris Hanson',
    phone: '636-399-6115',
    email: 'cwhanson@thebeandoctor.com',
  },
  'all type vacuum': {
    name: 'All Type Vacuum',
    contactPerson: 'Paul Unger',
    email: 'paul@all-typevacuum.com',
  },
  'kwikcopy': {
    name: 'KwikCopy',
    contactPerson: 'Lydia',
  },
  'quikcopy': {
    name: 'KwikCopy',
    contactPerson: 'Lydia',
  },
  "sam's": { name: "Sam's" },
  'sams': { name: "Sam's" },
  'amazon': { name: 'Amazon' },
  'bath & body works': { name: 'Bath & Body Works' },
  'bath and body works': { name: 'Bath & Body Works' },
  'cece': { name: 'Cece', contactPerson: 'Cece (Staff Shopper)' },
  'joe/cece': { name: 'Cece', contactPerson: 'Joe & Cece (Staff Shoppers)' },
  'precision roller': { name: 'Precision Roller' },
  'prescision roller': { name: 'Precision Roller' },
  'communion cups direct': {
    name: 'Communion Cups Direct',
    contactPerson: 'Customer Support',
    url: 'https://communioncups.net/communion-cups-1000-count',
  },
};

export function cleanVendor(raw: string | null | undefined): SanitizedVendor | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check if it's a URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('communioncups')) {
      return VENDOR_DIRECTORY['communion cups direct'];
    }
    return { name: 'Direct Online Supplier', url: trimmed };
  }

  // Parse contact blocks like "The Bean Doctor, Chris Hanson, 636-399-6115, cwhanson@thebeandoctor.com"
  if (trimmed.toLowerCase().includes('the bean doctor')) {
    return VENDOR_DIRECTORY['the bean doctor'];
  }
  if (trimmed.toLowerCase().includes('all type vacuum')) {
    return VENDOR_DIRECTORY['all type vacuum'];
  }
  if (trimmed.toLowerCase().includes('kwikcopy') || trimmed.toLowerCase().includes('quikcopy')) {
    return VENDOR_DIRECTORY['kwikcopy'];
  }
  if (trimmed.toLowerCase().includes('precision roller') || trimmed.toLowerCase().includes('prescision roller')) {
    return VENDOR_DIRECTORY['precision roller'];
  }
  if (trimmed.toLowerCase().includes('bath')) {
    return VENDOR_DIRECTORY['bath & body works'];
  }
  if (trimmed.toLowerCase().includes('sam')) {
    return VENDOR_DIRECTORY["sam's"];
  }

  const lookupKey = trimmed.toLowerCase();
  if (VENDOR_DIRECTORY[lookupKey]) {
    return VENDOR_DIRECTORY[lookupKey];
  }

  return { name: trimmed };
}

export function standardizeUnit(raw: string | null | undefined): string {
  if (!raw) return 'Units';
  const str = raw.trim().toLowerCase();
  const unitMap: Record<string, string> = {
    bag: 'Bags',
    bags: 'Bags',
    bottle: 'Bottles',
    bottles: 'Bottles',
    box: 'Boxes',
    boxes: 'Boxes',
    carton: 'Cartons',
    cartons: 'Cartons',
    case: 'Cases',
    cases: 'Cases',
    container: 'Containers',
    containers: 'Containers',
    cup: 'Cups',
    cups: 'Cups',
    fork: 'Forks',
    forks: 'Forks',
    gallon: 'Gallons',
    gallons: 'Gallons',
    knife: 'Knives',
    knives: 'Knives',
    napkin: 'Napkins',
    napkins: 'Napkins',
    pack: 'Packs',
    packs: 'Packs',
    package: 'Packs',
    packages: 'Packs',
    pad: 'Pads',
    pads: 'Pads',
    plate: 'Plates',
    plates: 'Plates',
    pod: 'Pods',
    pods: 'Pods',
    ream: 'Reams',
    reams: 'Reams',
    roll: 'Rolls',
    rolls: 'Rolls',
    spoon: 'Spoons',
    spoons: 'Spoons',
    toner: 'Toners',
    toners: 'Toners',
    bar: 'Bars',
    bars: 'Bars',
    card: 'Cards',
    cards: 'Cards',
  };
  return unitMap[str] || raw.trim();
}

export function cleanItemDetails(raw: string): {
  cleanName: string;
  reorderThreshold: number;
} {
  let cleanName = raw.trim();
  let reorderThreshold = 0;

  // Extract "Reorder Below 12 Bags" pattern
  const reorderMatch = cleanName.match(/reorder\s+below\s+(\d+)\s*\w*/i);
  if (reorderMatch) {
    reorderThreshold = parseInt(reorderMatch[1], 10);
    cleanName = cleanName.replace(/\s*reorder\s+below\s+\d+\s*\w*/i, '').trim();
  }

  return { cleanName, reorderThreshold };
}

export function parseOnHandNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Math.max(0, raw);
  const str = String(raw).trim();
  if (!str || str.includes('#N/A') || str.toLowerCase() === 'null') return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function categorizeItem(
  roomName: string,
  itemName: string
): 'consumables' | 'liturgical' | 'office' | 'kids' | 'facilities' {
  const roomLower = roomName.toLowerCase();
  const itemLower = itemName.toLowerCase();

  if (
    itemLower.includes('communion') ||
    itemLower.includes('grape juice') ||
    itemLower.includes('offering envelope') ||
    itemLower.includes('connection card')
  ) {
    return 'liturgical';
  }

  if (
    roomLower.includes('copier') ||
    itemLower.includes('toner') ||
    itemLower.includes('copy paper') ||
    itemLower.includes('cardstock') ||
    itemLower.includes('pens')
  ) {
    return 'office';
  }

  if (
    roomLower.includes('nursing') ||
    roomLower.includes('krew') ||
    itemLower.includes('baby wipe') ||
    itemLower.includes('diaper') ||
    itemLower.includes('granola') ||
    itemLower.includes('bobo')
  ) {
    return 'kids';
  }

  if (
    roomLower.includes('cleaning') ||
    itemLower.includes('toilet') ||
    itemLower.includes('cleaner') ||
    itemLower.includes('trash bag') ||
    itemLower.includes('paper towel')
  ) {
    return 'facilities';
  }

  return 'consumables';
}
