import { prisma } from '@/lib/prisma';

export async function onStockCountsSubmitted(params: {
  roomId?: string;
  lowStockItems: Array<{
    id: string;
    name: string;
    unit: string;
    idealQty: number;
    onHandQty: number;
    reorderThreshold: number;
    roomName: string;
    vendorName?: string | null;
  }>;
  submittedByName: string;
}) {
  const { roomId, lowStockItems, submittedByName } = params;
  if (lowStockItems.length === 0) return;

  try {
    // 1. Locate or create default operations project
    let project = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: 'Operations', mode: 'insensitive' } },
          { name: { contains: 'Facilities', mode: 'insensitive' } },
        ],
      },
      include: { sections: true },
    });

    if (!project) {
      project = await prisma.project.findFirst({
        include: { sections: true },
      });
    }

    if (!project) {
      // No project in the database yet
      return;
    }

    const todoSection =
      project.sections.find((s) => s.name.toUpperCase() === 'TODO' || s.name.toUpperCase() === 'TO DO') ||
      project.sections[0];

    if (!todoSection) return;

    const roomName = lowStockItems[0]?.roomName || 'General';
    const isCritical = lowStockItems.some((i) => i.onHandQty <= i.reorderThreshold && i.reorderThreshold > 0);
    const taskTitle = `Restock Needed: ${roomName} (${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} below par)`;

    const tableRows = lowStockItems
      .map((i) => `| ${i.name} | ${i.idealQty} | ${i.onHandQty} | **${i.idealQty - i.onHandQty} ${i.unit}** | ${i.vendorName || 'Unassigned'} |`)
      .join('\n');

    const description = `**Inventory count submitted by ${submittedByName}**\n\nThe following items are below par level and need reordering:\n\n| Item | Par | On Hand | Needed | Vendor |\n| :--- | :---: | :---: | :---: | :--- |\n${tableRows}\n\n[Open Inventory Hub & Restock Orders](/inventory/orders)`;

    // Check if an open task already exists for this room to avoid spamming
    const existingTask = await prisma.task.findFirst({
      where: {
        projectId: project.id,
        title: { startsWith: `Restock Needed: ${roomName}` },
        status: { not: 'DONE' },
        deletedAt: null,
      },
    });

    if (existingTask) {
      await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          title: taskTitle,
          description,
          priority: isCritical ? 'HIGH' : 'MEDIUM',
        },
      });
    } else {
      await prisma.task.create({
        data: {
          projectId: project.id,
          sectionId: todoSection.id,
          title: taskTitle,
          description,
          priority: isCritical ? 'HIGH' : 'MEDIUM',
          status: 'TODO',
        },
      });
    }
  } catch (err) {
    console.error('[InventoryWorkflowBridge] Failed to dispatch restock task:', err);
  }
}

export async function onOrderReceived(params: {
  poNumber: string;
  vendorName: string;
  items: Array<{
    itemName: string;
    roomName: string;
    buildingName: string;
    quantityReceived: number;
    unit: string;
  }>;
}) {
  const { poNumber, vendorName, items } = params;
  if (items.length === 0) return;

  try {
    let project = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: 'Facilities', mode: 'insensitive' } },
          { name: { contains: 'Operations', mode: 'insensitive' } },
        ],
      },
      include: { sections: true },
    });

    if (!project) {
      project = await prisma.project.findFirst({
        include: { sections: true },
      });
    }

    if (!project) return;

    const todoSection =
      project.sections.find((s) => s.name.toUpperCase() === 'TODO' || s.name.toUpperCase() === 'TO DO') ||
      project.sections[0];

    if (!todoSection) return;

    const taskTitle = `Distribute Order ${poNumber} (${vendorName}) to Rooms`;

    const itemLines = items
      .map((i) => `- **${i.quantityReceived} ${i.unit}** ${i.itemName} $\\rightarrow$ **${i.buildingName} / ${i.roomName}**`)
      .join('\n');

    const description = `**Purchase order ${poNumber} received from ${vendorName}**\n\nPlease deliver and stock the following items into their designated locations:\n\n${itemLines}\n\n[View Order Details](/inventory/orders)`;

    await prisma.task.create({
      data: {
        projectId: project.id,
        sectionId: todoSection.id,
        title: taskTitle,
        description,
        priority: 'MEDIUM',
        status: 'TODO',
      },
    });
  } catch (err) {
    console.error('[InventoryWorkflowBridge] Failed to dispatch delivery task:', err);
  }
}
