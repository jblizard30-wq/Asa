import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { RestockOrderDetailClient } from '@/components/RestockOrderDetailClient';

export default async function RestockOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const orderData = await prisma.restockOrder.findUnique({
    where: { id: params.id },
    include: {
      vendor: true,
      orderedBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          item: {
            include: {
              room: { include: { building: true } },
              inventoryType: true,
            },
          },
        },
      },
    },
  });

  if (!orderData) {
    notFound();
  }

  // Fetch available items from this vendor for adding to order
  const availableVendorItemsData = await prisma.inventoryItem.findMany({
    where: { vendorId: orderData.vendorId },
    orderBy: { name: 'asc' },
  });

  const shapedOrder = {
    id: orderData.id,
    poNumber: orderData.poNumber,
    status: orderData.status,
    orderDate: orderData.orderDate ? orderData.orderDate.toISOString() : null,
    expectedDelivery: orderData.expectedDelivery ? orderData.expectedDelivery.toISOString() : null,
    totalCost: orderData.totalCost ? Number(orderData.totalCost) : null,
    notes: orderData.notes,
    vendor: {
      id: orderData.vendor.id,
      name: orderData.vendor.name,
      contactPerson: orderData.vendor.contactPerson,
      email: orderData.vendor.email,
      phone: orderData.vendor.phone,
      url: orderData.vendor.url,
      notes: orderData.vendor.notes,
    },
    orderedBy: orderData.orderedBy,
    createdAt: orderData.createdAt.toISOString(),
    items: orderData.items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      itemName: i.item.name,
      unit: i.item.unit,
      quantityOrdered: i.quantityOrdered,
      quantityReceived: i.quantityReceived,
      unitPrice: i.unitPrice ? Number(i.unitPrice) : null,
      roomName: i.item.room.name,
      buildingName: i.item.room.building.name,
      shelfLocation: i.item.shelfLocation,
      categoryName: i.item.inventoryType?.name || null,
    })),
  };

  const shapedAvailableItems = availableVendorItemsData.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    idealQty: item.idealQty,
    onHandQty: item.onHandQty,
    neededQty: Math.max(item.idealQty - item.onHandQty, 0),
  }));

  return (
    <RestockOrderDetailClient
      canManage={canManage}
      order={shapedOrder}
      availableVendorItems={shapedAvailableItems}
    />
  );
}
