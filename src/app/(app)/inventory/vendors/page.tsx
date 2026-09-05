import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { VendorsListClient } from '@/components/VendorsListClient';

export default async function VendorsPage() {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const vendorsData = await prisma.vendor.findMany({
    include: {
      _count: {
        select: { items: true, restockOrders: true },
      },
      items: {
        select: {
          id: true,
          idealQty: true,
          onHandQty: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const shapedVendors = vendorsData.map((v) => {
    const neededItemCount = v.items.filter((i) => i.idealQty > i.onHandQty).length;
    return {
      id: v.id,
      name: v.name,
      contactPerson: v.contactPerson,
      phone: v.phone,
      email: v.email,
      url: v.url,
      notes: v.notes,
      itemCount: v._count.items,
      neededItemCount,
      orderCount: v._count.restockOrders,
    };
  });

  return <VendorsListClient canManage={canManage} vendors={shapedVendors} />;
}
