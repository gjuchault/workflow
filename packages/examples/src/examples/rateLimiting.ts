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
        rateLimit: {
          getRateLimitingKey: () => "job1",
          rules: [
            {
              id: "main",
              initialAmount: 1,
              amountRestored: 1,
              restoreEvery: 3000,
            },
          ],
        },
      },
    },
  });

  let done = 0;
  let testsCount = 3;

  workflow.registerHandler("job1", async () => {
    return new Promise((resolve) => {
      done++;

      if (done === testsCount) {
        resolve(undefined);
        setTimeout(() => process.exit(0), 1000);
        return;
      }

      setTimeout(() => {
        resolve(undefined);
      }, 4000);
    });
  });

  await workflow.startWorker();
  await workflow.startWorker();

  await workflow.start();

  for (let i = 0; i < testsCount; ++i) {
    workflow.enqueue("job1", { foo: "foo" });
  }
}

playground();
