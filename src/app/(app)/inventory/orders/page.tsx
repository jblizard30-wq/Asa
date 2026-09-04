import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { RestockOrdersListClient } from '@/components/RestockOrdersListClient';

export default async function RestockOrdersPage() {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const [ordersData, allItemsData, allVendorsData] = await Promise.all([
    prisma.restockOrder.findMany({
      include: {
        vendor: { select: { id: true, name: true } },
        orderedBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryItem.findMany({
      include: {
        room: { include: { building: true } },
        vendor: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.vendor.findMany({
      include: {
        items: {
          select: {
            id: true,
            name: true,
            unit: true,
            idealQty: true,
            onHandQty: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Filter items needing restock: neededQty = Math.max(idealQty - onHandQty, 0) > 0
  const neededItems = allItemsData.filter((i) => i.idealQty > i.onHandQty);

  // Group needed items by vendor
  const vendorGroupMap: Record<
    string,
    {
      vendorId: string;
      vendorName: string;
      contactPerson: string | null;
      email: string | null;
      phone: string | null;
      url: string | null;
      items: {
        id: string;
        name: string;
        unit: string;
        idealQty: number;
        onHandQty: number;
        neededQty: number;
        shelfLocation: string | null;
        roomName: string;
        buildingName: string;
      }[];
    }
  > = {};

  for (const item of neededItems) {
    const v = item.vendor;
    const vId = v?.id || 'unassigned';
    if (!vendorGroupMap[vId]) {
      vendorGroupMap[vId] = {
        vendorId: vId,
        vendorName: v?.name || 'Unassigned Supplier',
        contactPerson: v?.contactPerson || null,
        email: v?.email || null,
        phone: v?.phone || null,
        url: v?.url || null,
        items: [],
      };
    }

    vendorGroupMap[vId].items.push({
      id: item.id,
      name: item.name,
      unit: item.unit,
      idealQty: item.idealQty,
      onHandQty: item.onHandQty,
      neededQty: item.idealQty - item.onHandQty,
      shelfLocation: item.shelfLocation,
      roomName: item.room.name,
      buildingName: item.room.building.name,
    });
  }

  const vendorNeededGroups = Object.values(vendorGroupMap);

  const shapedOrders = ordersData.map((order) => ({
    id: order.id,
    poNumber: order.poNumber,
    vendorId: order.vendorId,
    vendorName: order.vendor.name,
    status: order.status,
    orderDate: order.orderDate ? order.orderDate.toISOString() : null,
    expectedDelivery: order.expectedDelivery ? order.expectedDelivery.toISOString() : null,
    totalCost: order.totalCost ? Number(order.totalCost) : null,
    itemCount: order._count.items,
    orderedByName: order.orderedBy?.name || null,
    createdAt: order.createdAt.toISOString(),
  }));

  const shapedVendors = allVendorsData.map((v) => ({
    id: v.id,
    name: v.name,
    items: v.items.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      idealQty: i.idealQty,
      onHandQty: i.onHandQty,
      neededQty: Math.max(i.idealQty - i.onHandQty, 0),
    })),
  }));

  return (
    <RestockOrdersListClient
      canManage={canManage}
      orders={shapedOrders}
      vendorNeededGroups={vendorNeededGroups}
      allVendors={shapedVendors}
    />
  );
}
