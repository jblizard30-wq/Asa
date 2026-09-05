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

  const [snapshots, budgetLines, packets] = await Promise.all([
    prisma.financialSnapshot.findMany({ orderBy: { periodDate: 'desc' }, take: 12 }),
    prisma.budgetLine.findMany({ orderBy: [{ fiscalYear: 'desc' }, { category: 'asc' }], take: 50 }),
    prisma.boardPacket.findMany({ orderBy: { meetingDate: 'desc' }, take: 12 }),
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
      packets={packets.map((p) => ({
        id: p.id,
        title: p.title,
        meetingDate: p.meetingDate.toISOString(),
        status: p.status,
        summaryNotes: p.summaryNotes,
      }))}
      tools={listToolDefinitions()}
    />
  );
}
