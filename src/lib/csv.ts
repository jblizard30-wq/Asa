/**
 * Shared CSV generation and formula injection neutralization utility.
 *
 * Implements RFC 4180 escaping and neutralizes Spreadsheet Formula Injection
 * (CSV Injection) attacks by prefixing cells that start with dangerous
 * formula trigger characters (=, +, -, @, \t, \r) with an apostrophe (').
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralizes formula triggers and escapes special CSV characters.
 */
export function escapeCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }

  let str = String(raw);

  // If the cell starts with a formula trigger, neutralize it with a single quote prefix
  if (str.length > 0 && FORMULA_TRIGGERS.includes(str[0])) {
    str = `'${str}`;
  }

  // If the cell contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an array of values into a single RFC 4180-compliant, injection-safe CSV row.
 */
export function formatCsvRow(values: unknown[]): string {
  return values.map(escapeCsvCell).join(',');
}

/**
 * Generates complete CSV file content with headers and row data.
 */
export function generateCsvContent(headers: string[], rows: unknown[][]): string {
  const headerLine = formatCsvRow(headers);
  const dataLines = rows.map((row) => formatCsvRow(row));
  return [headerLine, ...dataLines].join('\n');
}
