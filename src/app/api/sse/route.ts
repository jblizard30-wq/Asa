import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { appEvents, type AppBroadcastEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetProjectId = searchParams.get('projectId');

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
        // If a projectId was requested, only send events matching that project or global events
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

