import test from 'ava';

import { buildCallbackMap } from '../callbackMap';

test('callbackMap', (t) => {
  const callbackMap = buildCallbackMap();

  const sendMail = () => 0;
  const sendSecondMail = () => 0;
  const sendMails = () => [];

  callbackMap.add('flow', '123', 'task', 'sendMail', sendMail);
  callbackMap.add('flow', '123', 'task', 'sendMail', sendSecondMail);
  callbackMap.add('flow', '123', 'group', 'sendMails', sendMails);

  t.deepEqual(callbackMap.getKeys('flow', '123', 'task', 'sendMail'), [
    'flow-123-task-sendMail-0',
    'flow-123-task-sendMail-1',
  ]);
  t.deepEqual(callbackMap.getKeys('flow', '123', 'group', 'sendMails'), [
    'flow-123-group-sendMails-0',
  ]);
});
