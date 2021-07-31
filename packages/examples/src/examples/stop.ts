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
        concurrency: {
          maximumConcurrent: 1,
        },
      },
    },
  });

  workflow.registerHandler("job1", async () => {
    return new Promise(() => {
      setTimeout(() => {
        process.exit(1);
      }, 100000);
    });
  });

  await workflow.startWorker();
  await workflow.start();

  workflow.enqueue("job1", { foo: "foo" });

  setTimeout(async () => {
    try {
      await workflow.stop();
    } catch (err) {
      console.log(err);
      console.log(
        `☝️ this happens as the worker is working on a long task and couldn't be stopped in time`
      );
    }
    await workflowStorage.stop();
    process.exit(0);
  }, 12000);
}

playground();
