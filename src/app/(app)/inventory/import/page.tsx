import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { requireManagerOrAdmin } from '@/lib/actions/inventory';
import { CSVImporter } from '@/components/CSVImporter';

export const metadata = {
  title: 'Import CSV | Inventory | Asa',
};

export default async function InventoryImportPage() {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  await requireManagerOrAdmin();

  const inventoryTypes = await prisma.inventoryType.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="p-6 md:p-8">
      <CSVImporter inventoryTypes={inventoryTypes} />
    </div>
  );
}
