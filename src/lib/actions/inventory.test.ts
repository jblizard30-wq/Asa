import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  session: {
    user: { id: 'user-1', role: 'USER', name: 'Miguel Alvarez', email: 'miguel@example.org' },
  } as { user: { id: string; role: string; name: string; email: string } } | null,
  items: new Map<string, { id: string; name: string; idealQty: number; onHandQty: number; roomId: string; vendorId: string | null }>(),
  stockCounts: [] as Array<{ itemId: string; qty: number; submittedById: string }>,
  buildings: new Map<string, { id: string; name: string }>(),
  rooms: new Map<string, { id: string; name: string; buildingId: string }>(),
  vendors: new Map<string, { id: string; name: string }>(),
  orders: new Map<string, { id: string; poNumber: string; status: string; vendorId: string }>(),
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn(async (callbackOrArray) => {
        if (typeof callbackOrArray === 'function') {
          const tx = {
            stockCount: {
              create: vi.fn(async ({ data }) => {
                const row = { id: `count-${mockState.stockCounts.length + 1}`, ...data };
                mockState.stockCounts.push(row);
                return row;
              }),
            },
            inventoryItem: {
              update: vi.fn(async ({ where, data }) => {
                const item = mockState.items.get(where.id);
                if (!item) throw new Error('Item not found');
                const updated = { ...item, ...data };
                mockState.items.set(where.id, updated);
                return updated;
              }),
            },
            restockOrder: {
              update: vi.fn(async ({ where, data }) => {
                const order = mockState.orders.get(where.id);
                if (!order) throw new Error('Order not found');
                const updated = { ...order, ...data };
                mockState.orders.set(where.id, updated);
                return updated;
              }),
            },
            restockOrderItem: {
              update: vi.fn(async ({ data }) => data),
            },
          };
          return callbackOrArray(tx);
        }
        return Promise.all(callbackOrArray);
      }),
      inventoryItem: {
        findUnique: vi.fn(async ({ where }) => mockState.items.get(where.id) || null),
        findMany: vi.fn(async ({ where }) => {
          let list = Array.from(mockState.items.values());
          if (where?.vendorId) {
            list = list.filter((i) => i.vendorId === where.vendorId);
          }
          return list;
        }),
        delete: vi.fn(async ({ where }) => {
          mockState.items.delete(where.id);
          return { id: where.id };
        }),
      },
      building: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.name) {
            return Array.from(mockState.buildings.values()).find((b) => b.name === where.name) || null;
          }
          return mockState.buildings.get(where.id) || null;
        }),
        create: vi.fn(async ({ data }) => {
          const b = { id: `b-${Date.now()}`, ...data };
          mockState.buildings.set(b.id, b);
          return b;
        }),
      },
      room: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.buildingId_name) {
            return (
              Array.from(mockState.rooms.values()).find(
                (r) =>
                  r.buildingId === where.buildingId_name.buildingId &&
                  r.name === where.buildingId_name.name
              ) || null
            );
          }
          return mockState.rooms.get(where.id) || null;
        }),
        create: vi.fn(async ({ data }) => {
          const r = { id: `r-${Date.now()}`, ...data };
          mockState.rooms.set(r.id, r);
          return r;
        }),
      },
      vendor: {
        create: vi.fn(async ({ data }) => {
          const v = { id: `v-${Date.now()}`, ...data };
          mockState.vendors.set(v.id, v);
          return v;
        }),
      },
      restockOrder: {
        create: vi.fn(async ({ data }) => {
          const o = { id: `o-${Date.now()}`, ...data };
          mockState.orders.set(o.id, o);
          return o;
        }),
      },
    },
  };
});

import {
  submitStockCount,
  submitBatchStockCounts,
  quickRestockItemToPar,
  quickRestockVendorItemsToPar,
  createBuilding,
  createRoom,
  createVendor,
} from './inventory';

describe('Inventory Server Actions', () => {
  beforeEach(() => {
    mockState.items.clear();
    mockState.stockCounts = [];
    mockState.buildings.clear();
    mockState.rooms.clear();
    mockState.vendors.clear();
    mockState.orders.clear();
    mockState.session = {
      user: { id: 'user-1', role: 'USER', name: 'Miguel Alvarez', email: 'miguel@example.org' },
    };
    vi.clearAllMocks();
  });

  describe('Stock Counts (Open to authenticated staff)', () => {
    it('both inserts a StockCount row and updates onHandQty in the same transaction', async () => {
      mockState.items.set('item-1', {
        id: 'item-1',
        name: 'Coffee Beans',
        idealQty: 10,
        onHandQty: 2,
        roomId: 'room-1',
        vendorId: 'vendor-1',
      });

      const res = await submitStockCount({ itemId: 'item-1', qty: 7 });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.onHandQty).toBe(7);
      }

      // Check item in db state was updated to 7
      expect(mockState.items.get('item-1')?.onHandQty).toBe(7);

      // Check stockCounts received a new entry
      expect(mockState.stockCounts).toHaveLength(1);
      expect(mockState.stockCounts[0]).toMatchObject({
        itemId: 'item-1',
        qty: 7,
        submittedById: 'user-1',
      });
    });

    it('batch submits stock counts for multiple items transactionally', async () => {
      mockState.items.set('item-1', {
        id: 'item-1',
        name: 'Coffee Cups',
        idealQty: 20,
        onHandQty: 5,
        roomId: 'room-1',
        vendorId: null,
      });
      mockState.items.set('item-2', {
        id: 'item-2',
        name: 'Paper Towels',
        idealQty: 12,
        onHandQty: 0,
        roomId: 'room-1',
        vendorId: null,
      });

      const res = await submitBatchStockCounts({
        roomId: 'room-1',
        counts: {
          'item-1': 15,
          'item-2': 10,
        },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.count).toBe(2);
      }

      expect(mockState.items.get('item-1')?.onHandQty).toBe(15);
      expect(mockState.items.get('item-2')?.onHandQty).toBe(10);
      expect(mockState.stockCounts).toHaveLength(2);
    });

    it('quickRestockItemToPar sets onHandQty to idealQty and creates StockCount', async () => {
      mockState.items.set('item-1', {
        id: 'item-1',
        name: 'Sanitizer',
        idealQty: 8,
        onHandQty: 2,
        roomId: 'room-1',
        vendorId: null,
      });

      const res = await quickRestockItemToPar('item-1');
      expect(res.success).toBe(true);
      expect(mockState.items.get('item-1')?.onHandQty).toBe(8);
      expect(mockState.stockCounts[0].qty).toBe(8);
    });

    it('quickRestockVendorItemsToPar restocks all vendor items currently below par', async () => {
      mockState.items.set('item-1', {
        id: 'item-1',
        name: 'Beans A',
        idealQty: 10,
        onHandQty: 3,
        roomId: 'room-1',
        vendorId: 'vendor-1',
      });
      mockState.items.set('item-2', {
        id: 'item-2',
        name: 'Beans B (already par)',
        idealQty: 5,
        onHandQty: 5,
        roomId: 'room-1',
        vendorId: 'vendor-1',
      });
      mockState.items.set('item-3', {
        id: 'item-3',
        name: 'Filters',
        idealQty: 4,
        onHandQty: 1,
        roomId: 'room-1',
        vendorId: 'vendor-1',
      });

      const res = await quickRestockVendorItemsToPar('vendor-1');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.count).toBe(2); // Only items 1 and 3 were below par
      }

      expect(mockState.items.get('item-1')?.onHandQty).toBe(10);
      expect(mockState.items.get('item-2')?.onHandQty).toBe(5);
      expect(mockState.items.get('item-3')?.onHandQty).toBe(4);
      expect(mockState.stockCounts).toHaveLength(2);
    });
  });

  describe('Role-gated management actions', () => {
    it('blocks regular USER role from creating a building', async () => {
      mockState.session = {
        user: { id: 'user-volunteer', role: 'USER', name: 'Volunteer', email: 'vol@example.org' },
      };

      const res = await createBuilding({ name: 'New Wing' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Only managers and administrators');
      }
    });

    it('allows MANAGER or ADMIN role to create a building', async () => {
      mockState.session = {
        user: { id: 'user-manager', role: 'MANAGER', name: 'Renee Ortiz', email: 'renee@example.org' },
      };

      const res = await createBuilding({ name: 'Education Wing' });
      expect(res.success).toBe(true);
      expect(mockState.buildings.size).toBe(1);
    });

    it('blocks regular USER from creating a room', async () => {
      mockState.session = {
        user: { id: 'user-volunteer', role: 'USER', name: 'Volunteer', email: 'vol@example.org' },
      };

      const res = await createRoom({ buildingId: 'b-1', name: 'Room 101' });
      expect(res.success).toBe(false);
    });

    it('blocks regular USER from creating a vendor', async () => {
      mockState.session = {
        user: { id: 'user-volunteer', role: 'USER', name: 'Volunteer', email: 'vol@example.org' },
      };

      const res = await createVendor({ name: 'Acme Supply' });
      expect(res.success).toBe(false);
    });

    it('allows ADMIN to create vendor', async () => {
      mockState.session = {
        user: { id: 'user-admin', role: 'ADMIN', name: 'Pastor Dan', email: 'dan@example.org' },
      };

      const res = await createVendor({
        name: 'The Bean Doctor',
        email: 'cwhanson@thebeandoctor.com',
      });
      expect(res.success).toBe(true);
      expect(mockState.vendors.size).toBe(1);
    });
  });
});
