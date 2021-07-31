import { createWorkflowEngine } from "@workflow/core";
import { createWorkflowStorage } from "@workflow/pg";

import { postgresConnectionUri } from "../config";

type TaskMap = {
  job1: { input: { foo: string }; output: unknown };
};

async function playground() {
  const workflowStorage = await createWorkflowStorage({
    connectionUri: postgresConnectionUri,
    schema: "workflow",
  });

  const workflow = await createWorkflowEngine<TaskMap>({
    name: "myWfEngine",
    storage: workflowStorage,
    taskMap: {
      job1: {
        timeToLive: {
          taskExecutionTimeout: {
            policy: "retry",
            taskTimeout: 1000,
          },
        },
      },
    },
  });

  let i = 0;
  let handler: NodeJS.Timeout;

  workflow.registerHandler("job1", async (_task, { beat }) => {
    return new Promise((resolve) => {
      console.log(`Running job1 task`);

      function refresher() {
        beat();
        i++;

        if (i >= 5) {
          clearTimeout(handler);
          resolve(undefined);
          setTimeout(() => process.exit(0), 1000);
          return;
        }

        handler = setTimeout(refresher, 500);
      }

      handler = setTimeout(refresher, 500);
    });
  });

  await workflow.startWorker();

  await workflow.start();

  workflow.enqueue("job1", { foo: "foo" });
}

playground();
