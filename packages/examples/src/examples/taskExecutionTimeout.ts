import { createWorkflowEngine } from "@workflow/core";
import { createWorkflowStorage } from "@workflow/pg";

import { postgresConnectionUri } from "../config";

type TaskMap = {
  job1: { input: { foo: string }; output: unknown };
  job2: { input: { foo: string }; output: unknown };
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
      job2: {
        timeToLive: {
          taskExecutionTimeout: {
            policy: "abort",
            taskTimeout: 1000,
          },
        },
      },
    },
  });

  workflow.registerHandler("job1", async (_task, { attemptsMade }) => {
    return new Promise((resolve) => {
      console.log(`Running job1 task (${attemptsMade} attempts made so far)`);

      if (attemptsMade === 3) {
        resolve(undefined);
        setTimeout(() => process.exit(0), 1000);
        return;
      }

      setTimeout(() => {
        resolve(undefined);
      }, 2000);
    });
  });

  workflow.registerHandler("job2", async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, 2000);
    });
  });

  await workflow.startWorker();

  await workflow.start();

  workflow.enqueue("job1", { foo: "foo" });
  workflow.enqueue("job2", { foo: "foo" });
}

playground();
