import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { InventorySettingsClient } from '@/components/InventorySettingsClient';

export default async function InventorySettingsPage() {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';
  if (!canManage) {
    redirect('/inventory');
  }

  const [buildingsData, tracksData, itemsData, vendorsData] = await Promise.all([
    prisma.building.findMany({
      include: {
        rooms: {
          include: {
            _count: { select: { items: true } },
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
        room: { include: { building: true } },
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
    rooms: b.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      itemCount: r._count.items,
    })),
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
    reorderThreshold: item.reorderThreshold,
    shelfLocation: item.shelfLocation,
    sortOrder: item.sortOrder,
    notes: item.notes,
    roomId: item.roomId,
    roomName: item.room.name,
    buildingId: item.room.buildingId,
    buildingName: item.room.building.name,
    inventoryTypeId: item.inventoryTypeId,
    categoryName: item.inventoryType?.name || null,
    vendorId: item.vendorId,
    vendorName: item.vendor?.name || null,
  }));

  return (
    <InventorySettingsClient
      buildings={shapedBuildings}
      tracks={shapedTracks}
      items={shapedItems}
      vendors={vendorsData}
    />
  );
}
