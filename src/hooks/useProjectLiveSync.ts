'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useProjectLiveSync(projectId?: string, onUpdate?: () => void) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = projectId ? `/api/sse?projectId=${encodeURIComponent(projectId)}` : '/api/sse';
    const eventSource = new EventSource(url);

    eventSource.addEventListener('update', () => {
      if (onUpdate) {
        onUpdate();
      } else {
        router.refresh();
      }
    });

    eventSource.onerror = () => {
      // EventSource automatically attempts reconnection
    };

    return () => {
      eventSource.close();
    };
  }, [projectId, router, onUpdate]);
}

