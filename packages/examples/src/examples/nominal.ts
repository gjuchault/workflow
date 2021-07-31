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
      job1: {},
    },
  });

  workflow.registerHandler("job1", async (_task) => {
    return new Promise((resolve) => {
      console.log(`Running job1 task`);

      resolve(undefined);

      setTimeout(() => {
        process.exit(0);
      }, 200);
    });
  });

  await workflow.startWorker();

  await workflow.start();

  workflow.enqueue("job1", { foo: "foo" });
}

playground();
