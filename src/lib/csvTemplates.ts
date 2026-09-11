import { generateCsvContent } from './csv';

export interface CsvTemplateDefinition {
  filename: string;
  headers: string[];
  sampleRows: string[][];
  description: string;
}

export const CSV_TEMPLATES = {
  users: {
    filename: 'cpcana_staff_import_template.csv',
    headers: ['Name', 'Email', 'Role', 'Password'],
    sampleRows: [
      ['Pastor Dan Whitfield', 'pastor.dan@chespres.org', 'ADMIN', ''],
      ['Renee Ortiz', 'renee.ortiz@chespres.org', 'MANAGER', ''],
      ['Miguel Alvarez', 'miguel.alvarez@chespres.org', 'USER', ''],
      ['Casey Nguyen', 'casey.nguyen@chespres.org', 'USER', ''],
      ['Sarah Kim', 'sarah.kim@chespres.org', 'USER', ''],
    ],
    description: 'Staff & volunteer accounts import. Roles can be ADMIN, MANAGER, or USER. Password is optional.',
  },
  inventory: {
    filename: 'cpcana_inventory_import_template.csv',
    headers: ['Location/Building', 'Room', 'Item Name', 'On Hand', 'Unit', 'Vendor'],
    sampleRows: [
      ['Main Campus', 'Sanctuary AV Booth', 'XLR Audio Cable 25ft', '10', 'pcs', 'Sweetwater'],
      ['Student Center', 'Storage Closet B', 'Chairs (Folding)', '50', 'units', 'Lifetime'],
      ['Fellowship Hall', 'Kitchen Pantry', 'Ground Coffee (Dark Roast)', '12', 'bags', 'Costco'],
      ['Main Campus', 'Facilities Shed', 'Light Bulbs (LED 60W)', '24', 'pack', 'Home Depot'],
    ],
    description: 'Physical inventory items. Automatically links or creates buildings, rooms, and vendors.',
  },
  child_protection: {
    filename: 'cpcana_child_protection_template.csv',
    headers: [
      'Name',
      'Email',
      'Ministries',
      'DocuSign Signed',
      'MinistrySafe Completed Date',
      'Background Check Completed Date',
    ],
    sampleRows: [
      ['Sarah Jenkins', 'sarah.j@example.com', 'Kids Ministry; Nursery', 'Yes', '2024-05-15', '2023-11-20'],
      ['David Miller', 'david.m@example.com', 'Youth / Students', 'Yes', '2025-01-10', '2024-02-14'],
      ['Hannah Abbott', 'hannah.a@example.com', 'Nursery', 'No', '', ''],
      ['Marcus Vance', 'marcus.v@example.com', 'Kids Ministry; VBS', 'Yes', '2023-08-01', '2021-09-30'],
    ],
    description: 'Volunteer child protection compliance roster. Separate multiple ministries with a semicolon (;).',
  },
} as const;

export type CsvTemplateKey = keyof typeof CSV_TEMPLATES;

/**
 * Downloads a CSV template directly in the user's browser.
 */
export function downloadCsvTemplate(templateKey: CsvTemplateKey): void {
  const t = CSV_TEMPLATES[templateKey];
  if (!t) return;

  const csvString = generateCsvContent(
    [...t.headers],
    t.sampleRows.map((r) => [...r])
  );
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', t.filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
