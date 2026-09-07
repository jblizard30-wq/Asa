import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { getToolDefinition } from '@/lib/tools/registry';
import { FrameworkEditor } from '@/components/frameworks/FrameworkEditor';

export default async function FrameworkDetailPage({
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

  const framework = await prisma.strategicFramework.findUnique({
    where: { id: params.id },
    include: {
      packet: {
        select: { id: true, title: true },
      },
    },
  });

  if (!framework) {
    notFound();
  }

  const definition = getToolDefinition(framework.toolId);
  if (!definition) {
    notFound();
  }

  const packets = await prisma.boardPacket.findMany({
    orderBy: { meetingDate: 'desc' },
    take: 50,
  });

  return (
    <div className="py-2">
      <FrameworkEditor
        framework={{
          id: framework.id,
          toolId: framework.toolId,
          title: framework.title,
          status: framework.status,
          packetId: framework.packetId,
          data: framework.data,
          packet: framework.packet,
        }}
        definition={definition}
        packets={packets.map((p) => ({
          id: p.id,
          title: p.title,
          meetingDate: p.meetingDate.toISOString(),
          status: p.status,
        }))}
      />
    </div>
  );
}
