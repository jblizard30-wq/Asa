import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { getToolDefinition } from '@/lib/tools/registry';
import { BoardPacketViewer, type ResolvedPacketItem } from '@/components/BoardPacketViewer';
import type { BoardPacketItemRef } from '@/lib/actions/xp';

export default async function BoardPacketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isModuleEnabled('xp')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const packet = await prisma.boardPacket.findUnique({
    where: { id: params.id },
    include: {
      frameworks: true,
    },
  });

  if (!packet) {
    notFound();
  }

  const rawItems = Array.isArray(packet.items)
    ? (packet.items as unknown as BoardPacketItemRef[])
    : [];

  // Also include any frameworks linked via framework.packetId that might not yet be in packet.items
  const frameworkMap = new Map<string, typeof packet.frameworks[number]>();
  for (const f of packet.frameworks) {
    frameworkMap.set(f.id, f);
  }

  const resolvedItems: ResolvedPacketItem[] = [];

  // Add items recorded in packet.items
  for (const item of rawItems) {
    const fId = item.frameworkId || item.id;
    const fw = frameworkMap.get(fId) || null;
    const toolId = item.toolId || fw?.toolId || '';
    const definition = toolId ? getToolDefinition(toolId) : null;

    resolvedItems.push({
      id: item.id,
      type: item.type || 'framework',
      frameworkId: fId,
      toolId,
      title: item.title || fw?.title || 'Untitled Item',
      notes: item.notes,
      order: item.order ?? resolvedItems.length,
      framework: fw
        ? {
            id: fw.id,
            toolId: fw.toolId,
            title: fw.title,
            status: fw.status,
            data: fw.data,
          }
        : null,
      definition: definition || null,
    });
  }

  // If any framework has packetId == packet.id but wasn't in rawItems, append it
  for (const f of packet.frameworks) {
    if (!resolvedItems.some((r) => r.frameworkId === f.id)) {
      const definition = getToolDefinition(f.toolId);
      resolvedItems.push({
        id: f.id,
        type: 'framework',
        frameworkId: f.id,
        toolId: f.toolId,
        title: f.title,
        notes: null,
        order: resolvedItems.length,
        framework: {
          id: f.id,
          toolId: f.toolId,
          title: f.title,
          status: f.status,
          data: f.data,
        },
        definition: definition || null,
      });
    }
  }

  return (
    <div className="py-2">
      <BoardPacketViewer
        packet={{
          id: packet.id,
          title: packet.title,
          meetingDate: packet.meetingDate.toISOString(),
          status: packet.status,
          summaryNotes: packet.summaryNotes,
        }}
        items={resolvedItems}
        canManage={canManage}
      />
    </div>
  );
}
