import { EventEmitter } from 'events';

// Global singleton event emitter across Next.js API/action invocations
declare global {
  // eslint-disable-next-line no-var
  var __appEventEmitter: EventEmitter | undefined;
}

export const appEvents: EventEmitter = global.__appEventEmitter ?? new EventEmitter();
if (process.env.NODE_ENV !== 'production') {
  global.__appEventEmitter = appEvents;
}

export interface AppBroadcastEvent {
  type: 'TASK_UPDATED' | 'TASK_CREATED' | 'TASK_MOVED' | 'TASK_DELETED' | 'COMMENT_ADDED' | 'NOTIFICATION';
  projectId?: string;
  taskId?: string;
  actorId?: string;
  timestamp: string;
}

export function broadcastAppEvent(event: Omit<AppBroadcastEvent, 'timestamp'>) {
  const payload: AppBroadcastEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  appEvents.emit('app_event', payload);
}

