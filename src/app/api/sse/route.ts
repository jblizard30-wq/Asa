import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { appEvents, type AppBroadcastEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetProjectId = searchParams.get('projectId');

  // Scope the stream to projects the caller can actually see — same accessibility rule as
  // getTasksInRange/search — so a signed-in-but-wrong-scope user can't read cross-project
  // activity (task/project/actor IDs and event types) either by omitting projectId or by
  // passing one they're not a member of.
  const isAdmin = session.user.role === 'ADMIN';
  const accessibleProjects = await prisma.project.findMany({
    where: isAdmin
      ? { OR: [{ isPersonal: false }, { isPersonal: true, createdById: session.user.id }] }
      : { members: { some: { userId: session.user.id } } },
    select: { id: true },
  });
  const accessibleProjectIds = new Set(accessibleProjects.map((p) => p.id));
  if (targetProjectId && !accessibleProjectIds.has(targetProjectId)) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  let keepAliveInterval: NodeJS.Timeout | null = null;
  let eventHandler: ((event: AppBroadcastEvent) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected message
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'ok' })}\n\n`));

      // Keepalive heartbeat every 20s
      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
        }
      }, 20000);

      // Listen for app events
      eventHandler = (event: AppBroadcastEvent) => {
        // A project-scoped event only goes out if the caller can access that project; a
        // project-less event (e.g. a personal NOTIFICATION) always goes out, since it isn't
        // gated by project membership in the first place. Narrow further to targetProjectId
        // when the client asked for one specific project's stream.
        if (event.projectId && !accessibleProjectIds.has(event.projectId)) {
          return;
        }
        if (targetProjectId && event.projectId && event.projectId !== targetProjectId) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
        }
      };

      appEvents.on('app_event', eventHandler);
    },
    cancel() {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (eventHandler) appEvents.off('app_event', eventHandler);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

