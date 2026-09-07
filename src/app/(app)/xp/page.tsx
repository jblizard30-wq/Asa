import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { listToolDefinitions } from '@/lib/tools/registry';
import { XpClient } from '@/components/XpClient';

export default async function XpPage() {
  if (!isModuleEnabled('xp')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const [snapshots, budgetLines, packets, strategicFrameworks] = await Promise.all([
    prisma.financialSnapshot.findMany({ orderBy: { periodDate: 'desc' }, take: 12 }),
    prisma.budgetLine.findMany({ orderBy: [{ fiscalYear: 'desc' }, { category: 'asc' }], take: 50 }),
    prisma.boardPacket.findMany({ orderBy: { meetingDate: 'desc' }, take: 20 }),
    prisma.strategicFramework.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        packet: {
          select: { id: true, title: true },
        },
      },
    }),
  ]);

  // Decimal columns do not survive the server/client boundary — send numbers.
  return (
    <XpClient
      canManage={canManage}
      snapshots={snapshots.map((s) => ({
        id: s.id,
        periodDate: s.periodDate.toISOString(),
        unrestrictedCash: Number(s.unrestrictedCash),
        annualRevenue: Number(s.annualRevenue),
        annualExpense: Number(s.annualExpense),
        programExpense: Number(s.programExpense),
        personnelCost: Number(s.personnelCost),
        varianceNote: s.varianceNote,
      }))}
      budgetLines={budgetLines.map((b) => ({
        id: b.id,
        fiscalYear: b.fiscalYear,
        category: b.category,
        allocatedAmount: Number(b.allocatedAmount),
        spentAmount: Number(b.spentAmount),
        notes: b.notes,
      }))}
      packets={packets.map((p) => {
        const items = Array.isArray(p.items) ? (p.items as unknown as Array<{ id: string }>) : [];
        return {
          id: p.id,
          title: p.title,
          meetingDate: p.meetingDate.toISOString(),
          status: p.status,
          summaryNotes: p.summaryNotes,
          itemsCount: items.length,
        };
      })}
      strategicFrameworks={strategicFrameworks.map((f) => ({
        id: f.id,
        toolId: f.toolId,
        title: f.title,
        status: f.status,
        updatedAt: f.updatedAt.toISOString(),
        packetId: f.packetId,
        packet: f.packet,
      }))}
      tools={listToolDefinitions()}
    />
  );
}
