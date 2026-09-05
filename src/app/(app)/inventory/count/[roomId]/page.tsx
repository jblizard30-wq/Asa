import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { InventoryCountClient } from '@/components/InventoryCountClient';

export default async function CountRoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const { roomId } = params;

  const [room, items, inventoryTypes] = await Promise.all([
    prisma.room.findUnique({
      where: { id: roomId },
      include: { building: true },
    }),
    prisma.inventoryItem.findMany({
      where: { roomId },
      include: {
        inventoryType: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventoryType.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  if (!room) {
    notFound();
  }

  return (
    <InventoryCountClient
      roomId={roomId}
      roomName={room.name}
      buildingName={room.building?.name}
      items={items.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        idealQty: i.idealQty,
        onHandQty: i.onHandQty,
        reorderThreshold: i.reorderThreshold,
        shelfLocation: i.shelfLocation,
        sortOrder: i.sortOrder,
        notes: i.notes,
        inventoryTypeId: i.inventoryTypeId,
        inventoryType: i.inventoryType,
        vendor: i.vendor,
      }))}
      inventoryTypes={inventoryTypes}
    />
  );
}
