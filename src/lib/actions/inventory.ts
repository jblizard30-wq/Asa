'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession, requireManagerOrAdmin } from '@/lib/permissions';
import { isModuleEnabled } from '@/lib/modules';
import { Prisma } from '@prisma/client';

export type ActionResult<T = unknown> =
  | ({ success: true } & T)
  | { success: false; error: string };

/**
 * Server actions are individually addressable POST endpoints — the isModuleEnabled gate on
 * the /inventory pages does not cover them. Without this, every inventory mutation stays
 * live for a deployment that never bought the module. Called by every action below.
 */
function requireInventoryModule() {
  if (!isModuleEnabled('inventory')) {
    throw new Error('The Inventory module is not enabled for this deployment.');
  }
}

/**
 * Recomputes RestockOrder.totalCost from its current line items. Takes the transaction
 * client so the total is always written in the same transaction as the line-item change
 * that invalidated it, and can never be left disagreeing with the lines it sums.
 */
async function recomputeOrderTotal(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.restockOrderItem.findMany({ where: { orderId } });
  const total = items.reduce((sum, item) => {
    const price = item.unitPrice ? Number(item.unitPrice) : 0;
    return sum + price * item.quantityOrdered;
  }, 0);

  await tx.restockOrder.update({
    where: { id: orderId },
    data: { totalCost: new Prisma.Decimal(total) },
  });
}

function revalidateAllInventory() {
  revalidatePath('/inventory');
  revalidatePath('/inventory/orders');
  revalidatePath('/inventory/vendors');
  revalidatePath('/inventory/settings');
  // The dynamic routes (/inventory/count/[roomId], /inventory/orders/[id]) are per-id and
  // can't be blanket-revalidated here; each action revalidates the specific one it touched.
}

// ============================================================================
// Stock Counts (Open to all authenticated users)
// ============================================================================

const submitStockCountSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  qty: z.coerce.number().int().min(0, 'Quantity must be 0 or greater'),
});

/**
 * Submits a single stock count.
 * IMPORTANT: In the same Prisma transaction, both inserts the StockCount row
 * and updates InventoryItem.onHandQty to the submitted qty.
 */
export async function submitStockCount(input: {
  itemId: string;
  qty: number;
}): Promise<ActionResult<{ stockCountId: string; onHandQty: number }>> {
  try {
    requireInventoryModule();
    const session = await requireSession();
    const parsed = submitStockCountSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid count input' };
    }

    const { itemId, qty } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const stockCount = await tx.stockCount.create({
        data: {
          itemId,
          qty,
          submittedById: session.user.id,
        },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { onHandQty: qty },
        select: { id: true, onHandQty: true, roomId: true },
      });

      return { stockCountId: stockCount.id, onHandQty: updatedItem.onHandQty, roomId: updatedItem.roomId };
    });

    revalidateAllInventory();
    if (result.roomId) {
      revalidatePath(`/inventory/count/${result.roomId}`);
    }

    return { success: true, stockCountId: result.stockCountId, onHandQty: result.onHandQty };
  } catch (err: unknown) {
    console.error('Failed to submit stock count:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to submit stock count' };
  }
}

/**
 * Batch submits stock counts for multiple items (e.g. from the Room Counting Wizard).
 * In the same transaction, creates all StockCount rows and updates each InventoryItem.onHandQty.
 */
export async function submitBatchStockCounts(input: {
  roomId?: string;
  counts: Record<string, number>;
}): Promise<ActionResult<{ count: number }>> {
  try {
    requireInventoryModule();
    const session = await requireSession();
    const validEntries = Object.entries(input.counts).filter(
      ([, qty]) => typeof qty === 'number' && Number.isFinite(qty) && qty >= 0
    );

    if (validEntries.length === 0) {
      return { success: false, error: 'No valid counts to save' };
    }

    await prisma.$transaction(async (tx) => {
      for (const [itemId, qty] of validEntries) {
        const normalizedQty = Math.max(0, Math.floor(qty));
        await tx.stockCount.create({
          data: {
            itemId,
            qty: normalizedQty,
            submittedById: session.user.id,
          },
        });

        await tx.inventoryItem.update({
          where: { id: itemId },
          data: { onHandQty: normalizedQty },
        });
      }
    });

    revalidateAllInventory();
    if (input.roomId) {
      revalidatePath(`/inventory/count/${input.roomId}`);
    }

    return { success: true, count: validEntries.length };
  } catch (err: unknown) {
    console.error('Failed to submit batch counts:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to submit batch counts' };
  }
}

/**
 * 1-click quick restock: updates a single item's on-hand count to match its idealQty (par level).
 */
export async function quickRestockItemToPar(itemId: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    const session = await requireSession();
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    // Only ever raise stock to par, never lower it. Without this an overstocked item
    // (onHand 50, par 20) would be "restocked" down to 20, discarding 30 units of real
    // stock — quickRestockVendorItemsToPar already filters to under-par items this way.
    if (item.onHandQty >= item.idealQty) {
      return { success: true };
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockCount.create({
        data: {
          itemId,
          qty: item.idealQty,
          submittedById: session.user.id,
        },
      });

      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { onHandQty: item.idealQty },
      });
    });

    revalidateAllInventory();
    revalidatePath(`/inventory/count/${item.roomId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to quick restock item:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to quick restock item' };
  }
}

/**
 * 1-click quick restock for a vendor: brings all items under par for this vendor up to idealQty.
 */
export async function quickRestockVendorItemsToPar(
  vendorId: string | null
): Promise<ActionResult<{ count: number }>> {
  try {
    requireInventoryModule();
    const session = await requireSession();
    const items = await prisma.inventoryItem.findMany({
      where: { vendorId },
    });

    const neededItems = items.filter((i) => i.onHandQty < i.idealQty);
    if (neededItems.length === 0) {
      return { success: true, count: 0 };
    }

    await prisma.$transaction(async (tx) => {
      for (const item of neededItems) {
        await tx.stockCount.create({
          data: {
            itemId: item.id,
            qty: item.idealQty,
            submittedById: session.user.id,
          },
        });

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { onHandQty: item.idealQty },
        });
      }
    });

    revalidateAllInventory();
    return { success: true, count: neededItems.length };
  } catch (err: unknown) {
    console.error('Failed to quick restock vendor items:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to quick restock vendor items' };
  }
}

// ============================================================================
// Buildings (ADMIN | MANAGER)
// ============================================================================

const buildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').max(100),
});

export async function createBuilding(formData: FormData | { name: string }): Promise<ActionResult<{ buildingId: string }>> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const name = (formData instanceof FormData ? formData.get('name') : formData.name)?.toString().trim() ?? '';
    const parsed = buildingSchema.safeParse({ name });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid building name' };
    }

    const existing = await prisma.building.findUnique({ where: { name: parsed.data.name } });
    if (existing) {
      return { success: false, error: 'A building with this name already exists' };
    }

    const building = await prisma.building.create({
      data: { name: parsed.data.name },
    });

    revalidateAllInventory();
    return { success: true, buildingId: building.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create building' };
  }
}

export async function updateBuilding(
  id: string,
  formData: FormData | { name: string }
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const name = (formData instanceof FormData ? formData.get('name') : formData.name)?.toString().trim() ?? '';
    const parsed = buildingSchema.safeParse({ name });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid building name' };
    }

    await prisma.building.update({
      where: { id },
      data: { name: parsed.data.name },
    });

    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update building' };
  }
}

export async function deleteBuilding(id: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    await prisma.building.delete({ where: { id } });
    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete building' };
  }
}

// ============================================================================
// Rooms (ADMIN | MANAGER)
// ============================================================================

const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100),
  buildingId: z.string().min(1, 'Building is required'),
});

export async function createRoom(formData: FormData | { name: string; buildingId: string }): Promise<ActionResult<{ roomId: string }>> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const name = (formData instanceof FormData ? formData.get('name') : formData.name)?.toString().trim() ?? '';
    const buildingId = (formData instanceof FormData ? formData.get('buildingId') : formData.buildingId)?.toString().trim() ?? '';

    const parsed = roomSchema.safeParse({ name, buildingId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid room data' };
    }

    const existing = await prisma.room.findUnique({
      where: { buildingId_name: { buildingId: parsed.data.buildingId, name: parsed.data.name } },
    });
    if (existing) {
      return { success: false, error: 'A room with this name already exists in this building' };
    }

    const room = await prisma.room.create({
      data: {
        name: parsed.data.name,
        buildingId: parsed.data.buildingId,
      },
    });

    revalidateAllInventory();
    return { success: true, roomId: room.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create room' };
  }
}

export async function updateRoom(
  id: string,
  formData: FormData | { name: string; buildingId?: string }
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const name = (formData instanceof FormData ? formData.get('name') : formData.name)?.toString().trim() ?? '';
    const buildingId = (formData instanceof FormData ? formData.get('buildingId') : formData.buildingId)?.toString().trim() || undefined;

    if (!name) {
      return { success: false, error: 'Room name is required' };
    }

    await prisma.room.update({
      where: { id },
      data: {
        name,
        ...(buildingId ? { buildingId } : {}),
      },
    });

    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update room' };
  }
}

export async function deleteRoom(id: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    await prisma.room.delete({ where: { id } });
    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete room' };
  }
}

// ============================================================================
// Inventory Types / Categories (ADMIN | MANAGER)
// ============================================================================

const inventoryTypeSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100),
  description: z.string().max(500).optional(),
  trackingMode: z.string().default('par_level'),
  cadence: z.string().default('weekly'),
  icon: z.string().default('Package'),
});

export async function createInventoryType(
  input: {
    name: string;
    slug?: string;
    description?: string | null;
    trackingMode?: string;
    cadence?: string;
    icon?: string;
  }
): Promise<ActionResult<{ typeId: string }>> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const slug = (input.slug?.trim() || input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');
    const parsed = inventoryTypeSchema.safeParse({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || undefined,
      trackingMode: input.trackingMode || 'par_level',
      cadence: input.cadence || 'weekly',
      icon: input.icon || 'Package',
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid category data' };
    }

    const existing = await prisma.inventoryType.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, error: 'A category with this slug already exists' };
    }

    const created = await prisma.inventoryType.create({
      data: parsed.data,
    });

    revalidateAllInventory();
    return { success: true, typeId: created.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create inventory category' };
  }
}

export async function deleteInventoryType(id: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    await prisma.inventoryType.delete({ where: { id } });
    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete category' };
  }
}

// ============================================================================
// Inventory Items (ADMIN | MANAGER)
// ============================================================================

const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(150),
  unit: z.string().min(1, 'Unit of measure is required').max(50),
  idealQty: z.coerce.number().int().min(0, 'Par level must be 0 or greater'),
  onHandQty: z.coerce.number().int().min(0).default(0),
  reorderThreshold: z.coerce.number().int().min(0).default(0),
  shelfLocation: z.string().max(100).optional(),
  sortOrder: z.coerce.number().int().default(0),
  roomId: z.string().min(1, 'Room is required'),
  inventoryTypeId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function createInventoryItem(input: {
  name: string;
  unit: string;
  idealQty: number;
  onHandQty?: number;
  reorderThreshold?: number;
  shelfLocation?: string | null;
  sortOrder?: number;
  roomId: string;
  inventoryTypeId?: string | null;
  vendorId?: string | null;
  notes?: string | null;
}): Promise<ActionResult<{ itemId: string }>> {
  try {
    requireInventoryModule();
    const session = await requireManagerOrAdmin();
    const parsed = inventoryItemSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid item input' };
    }

    const {
      name,
      unit,
      idealQty,
      onHandQty = 0,
      reorderThreshold = 0,
      shelfLocation,
      sortOrder = 0,
      roomId,
      inventoryTypeId,
      vendorId,
      notes,
    } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          name,
          unit,
          idealQty,
          onHandQty,
          reorderThreshold,
          shelfLocation: shelfLocation?.trim() || null,
          sortOrder,
          roomId,
          inventoryTypeId: inventoryTypeId || null,
          vendorId: vendorId || null,
          notes: notes?.trim() || null,
        },
      });

      if (onHandQty > 0) {
        await tx.stockCount.create({
          data: {
            itemId: item.id,
            qty: onHandQty,
            submittedById: session.user.id,
          },
        });
      }

      return item;
    });

    revalidateAllInventory();
    revalidatePath(`/inventory/count/${roomId}`);
    return { success: true, itemId: result.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create item' };
  }
}

export async function updateInventoryItem(
  id: string,
  input: {
    name?: string;
    unit?: string;
    idealQty?: number;
    reorderThreshold?: number;
    shelfLocation?: string | null;
    sortOrder?: number;
    roomId?: string;
    inventoryTypeId?: string | null;
    vendorId?: string | null;
    notes?: string | null;
  }
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Item not found' };
    }

    await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.unit !== undefined ? { unit: input.unit.trim() } : {}),
        ...(input.idealQty !== undefined ? { idealQty: Math.max(0, input.idealQty) } : {}),
        ...(input.reorderThreshold !== undefined ? { reorderThreshold: Math.max(0, input.reorderThreshold) } : {}),
        ...(input.shelfLocation !== undefined ? { shelfLocation: input.shelfLocation?.trim() || null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
        ...(input.inventoryTypeId !== undefined ? { inventoryTypeId: input.inventoryTypeId || null } : {}),
        ...(input.vendorId !== undefined ? { vendorId: input.vendorId || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });

    revalidateAllInventory();
    revalidatePath(`/inventory/count/${existing.roomId}`);
    if (input.roomId && input.roomId !== existing.roomId) {
      revalidatePath(`/inventory/count/${input.roomId}`);
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update item' };
  }
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    await prisma.inventoryItem.delete({ where: { id } });
    revalidateAllInventory();
    if (item?.roomId) {
      revalidatePath(`/inventory/count/${item.roomId}`);
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete item' };
  }
}

// ============================================================================
// Vendors (ADMIN | MANAGER)
// ============================================================================

const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(100),
  contactPerson: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')).nullable(),
  url: z.string().url('Invalid URL format').optional().or(z.literal('')).nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function createVendor(input: {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  url?: string | null;
  notes?: string | null;
}): Promise<ActionResult<{ vendorId: string }>> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const parsed = vendorSchema.safeParse({
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      url: input.url?.trim() || null,
      notes: input.notes?.trim() || null,
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid vendor data' };
    }

    const vendor = await prisma.vendor.create({
      data: parsed.data,
    });

    revalidateAllInventory();
    return { success: true, vendorId: vendor.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create vendor' };
  }
}

export async function updateVendor(
  id: string,
  input: {
    name: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    url?: string | null;
    notes?: string | null;
  }
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const parsed = vendorSchema.safeParse({
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      url: input.url?.trim() || null,
      notes: input.notes?.trim() || null,
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid vendor data' };
    }

    await prisma.vendor.update({
      where: { id },
      data: parsed.data,
    });

    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update vendor' };
  }
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    await prisma.vendor.delete({ where: { id } });
    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete vendor' };
  }
}

// ============================================================================
// Restock / Purchase Orders (ADMIN | MANAGER)
// ============================================================================

export async function createRestockOrder(input: {
  vendorId: string;
  orderDate?: string | null;
  expectedDelivery?: string | null;
  notes?: string | null;
  items?: Array<{
    itemId: string;
    quantityOrdered: number;
    unitPrice?: number | null;
  }>;
}): Promise<ActionResult<{ orderId: string; poNumber: string }>> {
  try {
    requireInventoryModule();
    const session = await requireManagerOrAdmin();
    if (!input.vendorId) {
      return { success: false, error: 'Vendor is required' };
    }

    const totalCost = input.items?.reduce((sum, item) => {
      const price = item.unitPrice ?? 0;
      return sum + price * item.quantityOrdered;
    }, 0);

    const orderData = {
      vendorId: input.vendorId,
      status: 'draft',
      orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
      expectedDelivery: input.expectedDelivery ? new Date(input.expectedDelivery) : null,
      totalCost: totalCost !== undefined ? new Prisma.Decimal(totalCost) : null,
      notes: input.notes?.trim() || null,
      orderedById: session.user.id,
      items: input.items && input.items.length > 0
        ? {
            create: input.items.map((i) => ({
              itemId: i.itemId,
              quantityOrdered: Math.max(1, Math.floor(i.quantityOrdered)),
              quantityReceived: 0,
              unitPrice: i.unitPrice !== undefined && i.unitPrice !== null ? new Prisma.Decimal(i.unitPrice) : null,
            })),
          }
        : undefined,
    };

    // poNumber is @unique but only carries ~2 random digits on top of a 4-digit timestamp
    // slice, so two orders created in the same 10-second bucket collide about 1% of the
    // time. Retry on P2002 instead of surfacing a raw constraint error to the user.
    let order: { id: string; poNumber: string } | null = null;
    for (let attempt = 0; attempt < 5 && !order; attempt += 1) {
      const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
      const poNumber = `PO-${Date.now().toString().slice(-4)}${randomSuffix.slice(-2)}`;
      try {
        order = await prisma.restockOrder.create({
          data: { ...orderData, poNumber },
          select: { id: true, poNumber: true },
        });
      } catch (err: unknown) {
        const isDuplicatePo =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          String(err.meta?.target ?? '').includes('poNumber');
        if (!isDuplicatePo) throw err;
      }
    }

    if (!order) {
      return { success: false, error: 'Could not allocate a unique PO number. Please try again.' };
    }

    revalidateAllInventory();
    return { success: true, orderId: order.id, poNumber: order.poNumber };
  } catch (err: unknown) {
    console.error('Failed to create purchase order:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create restock order' };
  }
}

export async function updateRestockOrderStatus(
  orderId: string,
  status: 'draft' | 'ordered' | 'shipped' | 'received' | 'canceled'
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const validStatuses = ['draft', 'ordered', 'shipped', 'received', 'canceled'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: 'Invalid order status' };
    }

    // A received order is terminal. Without this guard, flipping it back to 'draft' and
    // re-receiving it adds the ordered quantity to stock a second time — which is exactly
    // the double-count the atomic claim in receiveRestockOrder exists to prevent.
    const claim = await prisma.restockOrder.updateMany({
      where: { id: orderId, status: { not: 'received' } },
      data: { status },
    });

    if (claim.count === 0) {
      const existing = await prisma.restockOrder.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!existing) {
        return { success: false, error: 'Order not found' };
      }
      if (status === 'received') {
        return { success: true };
      }
      return {
        success: false,
        error: 'This order has already been received and can no longer change status.',
      };
    }

    revalidateAllInventory();
    revalidatePath(`/inventory/orders/${orderId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update order status' };
  }
}

export async function updateRestockOrder(
  orderId: string,
  data: {
    orderDate?: string | null;
    expectedDelivery?: string | null;
    notes?: string | null;
  }
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    await prisma.restockOrder.update({
      where: { id: orderId },
      data: {
        // Distinguish "not supplied" (leave alone) from "explicitly cleared" (write null),
        // the way `notes` below already does. Writing null on undefined would erase a
        // stored date for any caller that only means to update one of these three fields.
        orderDate:
          data.orderDate !== undefined ? (data.orderDate ? new Date(data.orderDate) : null) : undefined,
        expectedDelivery:
          data.expectedDelivery !== undefined
            ? data.expectedDelivery
              ? new Date(data.expectedDelivery)
              : null
            : undefined,
        notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
      },
    });

    revalidateAllInventory();
    revalidatePath(`/inventory/orders/${orderId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update order' };
  }
}

export async function addRestockOrderItem(
  orderId: string,
  data: {
    itemId: string;
    quantityOrdered: number;
    unitPrice?: number | null;
  }
): Promise<ActionResult<{ orderItemId: string }>> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    if (!data.itemId || data.quantityOrdered <= 0) {
      return { success: false, error: 'Invalid item or quantity' };
    }

    // One transaction: the line item and the parent order's totalCost must not be able to
    // diverge. Recomputing the total in a separate write left a window where a failure —
    // or a concurrent line edit — produced an order whose total didn't match its lines.
    const orderItem = await prisma.$transaction(async (tx) => {
      const created = await tx.restockOrderItem.create({
        data: {
          orderId,
          itemId: data.itemId,
          quantityOrdered: Math.max(1, Math.floor(data.quantityOrdered)),
          quantityReceived: 0,
          unitPrice:
            data.unitPrice !== undefined && data.unitPrice !== null ? new Prisma.Decimal(data.unitPrice) : null,
        },
      });

      await recomputeOrderTotal(tx, orderId);
      return created;
    });

    revalidateAllInventory();
    revalidatePath(`/inventory/orders/${orderId}`);
    return { success: true, orderItemId: orderItem.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to add item to order' };
  }
}

export async function updateRestockOrderItem(
  orderItemId: string,
  data: {
    quantityOrdered?: number;
    quantityReceived?: number;
    unitPrice?: number | null;
  }
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const existing = await prisma.restockOrderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });
    if (!existing) {
      return { success: false, error: 'Order item not found' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.restockOrderItem.update({
        where: { id: orderItemId },
        data: {
          ...(data.quantityOrdered !== undefined
            ? { quantityOrdered: Math.max(0, Math.floor(data.quantityOrdered)) }
            : {}),
          ...(data.quantityReceived !== undefined
            ? { quantityReceived: Math.max(0, Math.floor(data.quantityReceived)) }
            : {}),
          ...(data.unitPrice !== undefined
            ? { unitPrice: data.unitPrice !== null ? new Prisma.Decimal(data.unitPrice) : null }
            : {}),
        },
      });

      await recomputeOrderTotal(tx, existing.orderId);
    });

    revalidateAllInventory();
    revalidatePath(`/inventory/orders/${existing.orderId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update order item' };
  }
}

export async function deleteRestockOrderItem(orderItemId: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    const existing = await prisma.restockOrderItem.findUnique({ where: { id: orderItemId } });
    if (!existing) {
      return { success: false, error: 'Order item not found' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.restockOrderItem.delete({ where: { id: orderItemId } });
      await recomputeOrderTotal(tx, existing.orderId);
    });

    revalidateAllInventory();
    revalidatePath(`/inventory/orders/${existing.orderId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete order item' };
  }
}

/**
 * Marks an entire restock order as received, setting quantityReceived to quantityOrdered.
 * If updateStock is true, updates each item's onHandQty and records a StockCount in the same transaction.
 */
export async function receiveRestockOrder(
  orderId: string,
  updateStock: boolean = true
): Promise<ActionResult> {
  try {
    requireInventoryModule();
    const session = await requireManagerOrAdmin();

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.restockOrder.findUnique({
        where: { id: orderId },
        select: { id: true },
      });
      if (!existing) return 'not-found' as const;

      // Atomically claim the receive instead of checking status and then acting on it.
      // A duplicate submit (double-click, retry, two managers at once) matches zero rows
      // here and becomes a no-op, rather than adding the ordered quantity to stock twice.
      const claim = await tx.restockOrder.updateMany({
        where: { id: orderId, status: { not: 'received' } },
        data: { status: 'received' },
      });
      if (claim.count === 0) return 'already-received' as const;

      // Read line items inside the transaction so they can't shift under us mid-receive.
      const orderItems = await tx.restockOrderItem.findMany({ where: { orderId } });

      for (const orderItem of orderItems) {
        await tx.restockOrderItem.update({
          where: { id: orderItem.id },
          data: { quantityReceived: orderItem.quantityOrdered },
        });

        if (updateStock) {
          // Atomic increment rather than a read-modify-write off a snapshot taken outside
          // the transaction: a concurrent stock count (which writes onHandQty absolutely)
          // or a second PO for the same item can no longer be silently clobbered.
          const updatedItem = await tx.inventoryItem.update({
            where: { id: orderItem.itemId },
            data: { onHandQty: { increment: orderItem.quantityOrdered } },
            select: { onHandQty: true },
          });

          await tx.stockCount.create({
            data: {
              itemId: orderItem.itemId,
              qty: updatedItem.onHandQty,
              submittedById: session.user.id,
            },
          });
        }
      }

      return 'received' as const;
    });

    if (outcome === 'not-found') {
      return { success: false, error: 'Order not found' };
    }
    if (outcome === 'already-received') {
      return { success: false, error: 'This order has already been received.' };
    }

    revalidateAllInventory();
    revalidatePath(`/inventory/orders/${orderId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to receive order:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to receive order' };
  }
}

export async function deleteRestockOrder(orderId: string): Promise<ActionResult> {
  try {
    requireInventoryModule();
    await requireManagerOrAdmin();
    await prisma.restockOrder.delete({ where: { id: orderId } });
    revalidateAllInventory();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete order' };
  }
}
