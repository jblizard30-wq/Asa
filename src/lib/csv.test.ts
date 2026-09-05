import { describe, it, expect } from 'vitest';
import { escapeCsvCell, formatCsvRow, generateCsvContent } from './csv';

describe('CSV Formula Injection Sanitization', () => {
  it('neutralizes leading =, +, -, @, \\t, \\r formula triggers', () => {
    expect(escapeCsvCell('=1+1')).toBe(`'=1+1`);
    expect(escapeCsvCell('+SUM(A1:A10)')).toBe(`'+SUM(A1:A10)`);
    expect(escapeCsvCell('-5')).toBe(`'-5`);
    expect(escapeCsvCell('@cmd')).toBe(`'@cmd`);
    expect(escapeCsvCell('\tmalicious')).toBe(`'\tmalicious`);
  });

  it('escapes quotes, commas, and newlines properly according to RFC 4180', () => {
    expect(escapeCsvCell('Hello, World')).toBe('"Hello, World"');
    expect(escapeCsvCell('She said "Hello"')).toBe('"She said ""Hello"""');
    expect(escapeCsvCell('Multi\nLine')).toBe('"Multi\nLine"');
  });

  it('neutralizes formula trigger and escapes quotes/commas when both are present', () => {
    expect(escapeCsvCell('=SUM("A1,B2")')).toBe('"\'=SUM(""A1,B2"")"');
  });

  it('leaves safe alphanumeric strings unquoted', () => {
    expect(escapeCsvCell('Standard Item')).toBe('Standard Item');
    expect(escapeCsvCell('12345')).toBe('12345');
    expect(escapeCsvCell('facilities-dept')).toBe('facilities-dept');
  });

  it('handles null and undefined gracefully', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('formats entire rows and multi-line CSVs safely', () => {
    const headers = ['Item', 'Price', 'Notes'];
    const rows = [
      ['=SUM(A1:B2)', 10.5, 'Normal note'],
      ['Safe Item', 25.0, 'Note with "quotes", comma'],
    ];

    const csv = generateCsvContent(headers, rows);
    expect(csv).toBe(
      'Item,Price,Notes\n' +
      "'=SUM(A1:B2),10.5,Normal note\n" +
      'Safe Item,25,"Note with ""quotes"", comma"'
    );
  });
});
