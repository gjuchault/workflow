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
        retry: {
          maximumRetries: 5,
        },
      },
    },
  });

  workflow.registerHandler("job1", async (_task, { attemptsMade }) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (attemptsMade < 4) {
          reject(undefined);
        } else {
          resolve(undefined);
          setTimeout(() => process.exit(0), 500);
        }
      }, 2000);
    });
  });

  await workflow.startWorker();

  await workflow.start();

  workflow.enqueue("job1", { foo: "foo" });
}

playground();
