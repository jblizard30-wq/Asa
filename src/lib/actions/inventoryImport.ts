'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireManagerOrAdmin, requireSession } from '@/lib/actions/inventory';
import { isModuleEnabled } from '@/lib/modules';
import {
  cleanVendor,
  standardizeUnit,
  cleanItemDetails,
  parseOnHandNumber,
  VENDOR_DIRECTORY,
} from '@/lib/csv-sanitizer';

function requireInventoryModule(): void {
  if (!isModuleEnabled('inventory')) {
    throw new Error('Inventory module is not enabled for this deployment');
  }
}

export interface ImportPreviewRow {
  building: string;
  room: string;
  item: string;
  unit: string;
  idealQty: number;
  onHandQty: number;
  reorderThreshold: number;
  vendor: string | null;
  vendorContact?: string | null;
  vendorEmail?: string | null;
  vendorPhone?: string | null;
  vendorUrl?: string | null;
}

export async function parseAndPreviewCSV(csvContent: string): Promise<ImportPreviewRow[]> {
  requireInventoryModule();
  await requireManagerOrAdmin();

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];

  // Parse CSV rows handling quoted values
  function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const rows: ImportPreviewRow[] = [];

  // Detect column mapping from header
  const headerCols = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  let bIdx = 0;
  let rIdx = 1;
  let iIdx = 2;
  let oIdx = 3;
  let uIdx = 4;
  let vIdx = 5;

  headerCols.forEach((col, idx) => {
    if (col.includes('building') || col.includes('campus')) bIdx = idx;
    else if (col.includes('room') || col.includes('location')) rIdx = idx;
    else if (col.includes('item') || col.includes('name') || col.includes('product')) iIdx = idx;
    else if (col.includes('on hand') || col.includes('onhand') || col.includes('qty')) oIdx = idx;
    else if (col.includes('unit') || col.includes('type')) uIdx = idx;
    else if (col.includes('vendor') || col.includes('supplier')) vIdx = idx;
  });

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const buildingRaw = cols[bIdx] || 'Main Campus';
    const roomRaw = cols[rIdx] || 'General Storage';
    const itemRaw = cols[iIdx] || '';
    const onHandRaw = cols[oIdx] || '0';
    const unitRaw = cols[uIdx] || 'Units';
    const vendorRaw = cols[vIdx] || '';

    if (!itemRaw) continue;

    const { cleanName, reorderThreshold } = cleanItemDetails(itemRaw);
    const unit = standardizeUnit(unitRaw);
    const onHandQty = parseOnHandNumber(onHandRaw);
    const vendorCleaned = cleanVendor(vendorRaw);

    rows.push({
      building: buildingRaw,
      room: roomRaw,
      item: cleanName,
      unit,
      idealQty: Math.max(reorderThreshold > 0 ? reorderThreshold * 2 : 2, onHandQty, 2),
      onHandQty,
      reorderThreshold: reorderThreshold || 1,
      vendor: vendorCleaned?.name || null,
      vendorContact: vendorCleaned?.contactPerson || null,
      vendorEmail: vendorCleaned?.email || null,
      vendorPhone: vendorCleaned?.phone || null,
      vendorUrl: vendorCleaned?.url || null,
    });
  }

  return rows;
}

export async function executeBatchImport(input: {
  inventoryTypeId: string;
  rows: ImportPreviewRow[];
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    requireInventoryModule();
    const session = await requireSession();
    await requireManagerOrAdmin();

    const { inventoryTypeId, rows } = input;
    if (!rows || rows.length === 0) return { success: false, count: 0, error: 'No rows to import' };

    let createdCount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Ensure all buildings exist
      const uniqueBuildings = Array.from(new Set(rows.map((r) => r.building.trim())));
      const buildingMap = new Map<string, string>();

      for (const bName of uniqueBuildings) {
        let b = await tx.building.findUnique({ where: { name: bName } });
        if (!b) {
          b = await tx.building.create({ data: { name: bName } });
        }
        buildingMap.set(bName, b.id);
      }

      // 2. Ensure all rooms exist
      const roomMap = new Map<string, string>();
      for (const row of rows) {
        const bId = buildingMap.get(row.building.trim());
        if (!bId) continue;
        const key = `${bId}:::${row.room.trim()}`;
        if (!roomMap.has(key)) {
          let room = await tx.room.findUnique({
            where: { buildingId_name: { buildingId: bId, name: row.room.trim() } },
          });
          if (!room) {
            room = await tx.room.create({
              data: { buildingId: bId, name: row.room.trim() },
            });
          }
          roomMap.set(key, room.id);
        }
      }

      // 3. Ensure all vendors exist
      const vendorMap = new Map<string, string>();
      const uniqueVendors = Array.from(
        new Set(rows.map((r) => r.vendor?.trim()).filter((v): v is string => Boolean(v)))
      );

      for (const vName of uniqueVendors) {
        const known = VENDOR_DIRECTORY[vName.toLowerCase()];
        let v = await tx.vendor.findFirst({ where: { name: { equals: vName, mode: 'insensitive' } } });
        if (!v) {
          v = await tx.vendor.create({
            data: {
              name: vName,
              contactPerson: known?.contactPerson || null,
              email: known?.email || null,
              phone: known?.phone || null,
              url: known?.url || null,
            },
          });
        }
        vendorMap.set(vName, v.id);
      }

      // 4. Create Items and initial StockCount
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const bId = buildingMap.get(r.building.trim());
        const roomId = bId ? roomMap.get(`${bId}:::${r.room.trim()}`) : null;
        if (!roomId) continue;

        const vendorId = r.vendor ? vendorMap.get(r.vendor.trim()) || null : null;

        const item = await tx.inventoryItem.create({
          data: {
            inventoryTypeId: inventoryTypeId || null,
            roomId,
            name: r.item.trim(),
            unit: r.unit,
            idealQty: r.idealQty,
            onHandQty: r.onHandQty,
            reorderThreshold: r.reorderThreshold,
            vendorId,
            sortOrder: idx + 1,
          },
        });

        if (r.onHandQty > 0) {
          await tx.stockCount.create({
            data: {
              itemId: item.id,
              qty: r.onHandQty,
              submittedById: session.user.id,
            },
          });
        }

        createdCount++;
      }
    });

    revalidatePath('/inventory');
    revalidatePath('/inventory/orders');
    revalidatePath('/inventory/settings');

    return { success: true, count: createdCount };
  } catch (err: unknown) {
    console.error('Batch import failed:', err);
    return { success: false, count: 0, error: err instanceof Error ? err.message : 'Batch import failed' };
  }
}
