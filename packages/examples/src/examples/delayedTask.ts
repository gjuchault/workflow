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

  workflow.registerHandler("job1", async () => {
    process.exit(0);
  });

  await workflow.startWorker();

  await workflow.start();

  workflow.enqueue(
    "job1",
    { foo: "foo" },
    { processAt: new Date(Date.now() + 5000) }
  );
}

playground();
