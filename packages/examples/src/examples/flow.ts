import { createWorkflowEngine } from "@workflow/core";
import { createWorkflowStorage } from "@workflow/pg";

import { postgresConnectionUri } from "../config";

type TaskMap = {
  job1: { input: { someIds: string[] }; output: string[] };
  job2: { input: { someId: string }; output: string };
  job3: { input: { someIds: string[] }; output: string[] };
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
      job2: {},
      job3: {},
    },
  });

  workflow.registerHandler("job1", async ({ payload }) => {
    return new Promise<string[]>((resolve) => {
      setTimeout(() => {
        resolve(payload.someIds);
      }, 2000);
    });
  });

  workflow.registerHandler("job2", async ({ payload }) => {
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve(payload.someId);
      }, 2000);
    });
  });

  workflow.registerHandler("job3", async ({ payload }) => {
    return new Promise<string[]>((resolve) => {
      setTimeout(() => {
        resolve(payload.someIds);
      }, 2000);
    });
  });

  const myFlow = await workflow.createFlow<{ someIds: string[] }>(
    "myFlow",
    (flow, input) => {
      flow.enqueue("job1", input);

      flow.onTaskDone("job1", async (someIds) => {
        console.log("job1 done", someIds);
        const group = flow.createGroup();

        await Promise.all(
          someIds.map((someId) => flow.enqueue("job2", { someId }, { group }))
        );
      });

      flow.onGroupTaskDone("job2", async (someIds) => {
        console.log("job2 done", someIds);

        await flow.enqueue("job3", { someIds });
      });

      flow.onTaskDone("job3", (someIds) => {
        console.log("job3 done", someIds);
        flow.stop();
        process.exit(0);
      });
    }
  );

  await myFlow.start({ someIds: ["one", "two"] });

  await workflow.startWorker();
  await workflow.startWorker();

  await workflow.start();
}

playground();
