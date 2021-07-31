import { debug } from 'debug';

import { Events } from './events';
import { Storage } from './storage';

const log = debug('workflow:core:leadership');

export type LeadershipEngine = {
  readonly tryToTakeLeadership: (schedulerId: string) => Promise<boolean>;
};

export type CreateLeadershipEngineDependencies = {
  readonly storage: Storage;
  readonly events: Events;
};

export function createLeadershipEngine({
  storage,
  events,
}: CreateLeadershipEngineDependencies): LeadershipEngine {
  async function tryToTakeLeadership(schedulerId: string): Promise<boolean> {
    const [deadLeadersResigned] = await Promise.all([
      storage.resignDeadLeaders(),
      storage.refreshSchedulersLocks([schedulerId]),
    ]);

    if (deadLeadersResigned > 0) {
      events.emit('leadership:deadLeader');
      log('The leader was found dead');
    }

    const gotLeadership = await storage.tryToSetMasterScheduler(schedulerId);

    events.emit('leadership:newLeader', schedulerId);

    return gotLeadership;
  }

  return {
    tryToTakeLeadership,
  };
}
