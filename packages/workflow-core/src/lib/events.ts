import EventEmitter from 'eventemitter3';

type EventsMap = {
  'leadership:deadLeader': () => void;
  'leadership:newLeader': (schedulerId: string) => void;
  'task:enqueued': (taskId: string) => void;
  'task:assigned': (taskId: string) => void;
  'task:failed': (task: { id: string; name: string; error: unknown }) => void;
  'task:done': (task: { id: string; name: string; output: unknown }) => void;
};

export type Events = EventEmitter<EventsMap>;

export function buildEvents(): Events {
  return new EventEmitter<EventsMap>();
}
