import { describe, it, expect } from 'vitest';
import { CSV_TEMPLATES } from './csvTemplates';
import { generateCsvContent } from './csv';

describe('CSV Templates Registry', () => {
  it('defines valid templates for users, inventory, and child_protection', () => {
    expect(CSV_TEMPLATES.users).toBeDefined();
    expect(CSV_TEMPLATES.inventory).toBeDefined();
    expect(CSV_TEMPLATES.child_protection).toBeDefined();
  });

  it('generates well-formed CSV for child_protection template', () => {
    const t = CSV_TEMPLATES.child_protection;
    const content = generateCsvContent([...t.headers], t.sampleRows.map(r => [...r]));
    const lines = content.split('\n');

    expect(lines.length).toBe(t.sampleRows.length + 1);
    expect(lines[0]).toBe('Name,Email,Ministries,DocuSign Signed,MinistrySafe Completed Date,Background Check Completed Date');
    expect(lines[1]).toContain('Kids Ministry; Nursery');
  });

  it('generates well-formed CSV for inventory template', () => {
    const t = CSV_TEMPLATES.inventory;
    const content = generateCsvContent([...t.headers], t.sampleRows.map(r => [...r]));
    const lines = content.split('\n');

    expect(lines.length).toBe(t.sampleRows.length + 1);
    expect(lines[0]).toBe('Location/Building,Room,Item Name,On Hand,Unit,Vendor');
    expect(lines[1]).toContain('XLR Audio Cable 25ft');
  });

  it('generates well-formed CSV for users template', () => {
    const t = CSV_TEMPLATES.users;
    const content = generateCsvContent([...t.headers], t.sampleRows.map(r => [...r]));
    const lines = content.split('\n');

    expect(lines.length).toBe(t.sampleRows.length + 1);
    expect(lines[0]).toBe('Name,Email,Role,Password');
    expect(lines[1]).toContain('Pastor Dan Whitfield');
  });
});
