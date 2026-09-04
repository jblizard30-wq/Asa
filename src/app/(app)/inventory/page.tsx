import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { InventoryDashboardClient } from '@/components/InventoryDashboardClient';

export default async function InventoryPage() {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const [buildingsData, tracksData, itemsData, vendorsData] = await Promise.all([
    prisma.building.findMany({
      include: {
        rooms: {
          include: {
            items: {
              select: {
                id: true,
                idealQty: true,
                onHandQty: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryType.findMany({
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryItem.findMany({
      include: {
        room: {
          include: {
            building: true,
          },
        },
        inventoryType: true,
        vendor: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.vendor.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const shapedBuildings = buildingsData.map((b) => ({
    id: b.id,
    name: b.name,
    rooms: b.rooms.map((r) => {
      const neededCount = r.items.filter((item) => item.idealQty > item.onHandQty).length;
      return {
        id: r.id,
        name: r.name,
        itemCount: r.items.length,
        neededCount,
      };
    }),
  }));

  const shapedTracks = tracksData.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    cadence: t.cadence,
    trackingMode: t.trackingMode,
    icon: t.icon,
    itemCount: t._count.items,
  }));

  const shapedItems = itemsData.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    idealQty: item.idealQty,
    onHandQty: item.onHandQty,
    neededQty: Math.max(item.idealQty - item.onHandQty, 0),
    reorderThreshold: item.reorderThreshold,
    shelfLocation: item.shelfLocation,
    sortOrder: item.sortOrder,
    notes: item.notes,
    roomId: item.roomId,
    room: {
      id: item.room.id,
      name: item.room.name,
      buildingId: item.room.buildingId,
      building: {
        id: item.room.building.id,
        name: item.room.building.name,
      },
    },
    inventoryTypeId: item.inventoryTypeId,
    inventoryType: item.inventoryType
      ? {
          id: item.inventoryType.id,
          name: item.inventoryType.name,
          slug: item.inventoryType.slug,
          icon: item.inventoryType.icon,
        }
      : null,
    vendorId: item.vendorId,
    vendor: item.vendor ? { id: item.vendor.id, name: item.vendor.name } : null,
  }));

  return (
    <InventoryDashboardClient
      canManage={canManage}
      buildings={shapedBuildings}
      tracks={shapedTracks}
      items={shapedItems}
      vendors={vendorsData}
    />
  );
}
