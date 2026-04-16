import { tasks } from "@trigger.dev/sdk/v3";

export async function triggerTaskAndWait<Payload, Output>(
  taskId: string,
  payload: Payload,
  fallback: (payload: Payload) => Promise<Output>,
): Promise<Output> {
  const triggerTasks = tasks as unknown as {
    triggerAndWait?: (
      id: string,
      payload: Payload,
    ) => Promise<{ output?: Output } | Output>;
    trigger?: (
      id: string,
      payload: Payload,
    ) => Promise<{
      wait?: () => Promise<{ output?: Output } | Output>;
    }>;
  };

  try {
    if (triggerTasks.triggerAndWait) {
      const result = await triggerTasks.triggerAndWait(taskId, payload);
      return (result as { output?: Output }).output ?? (result as Output);
    }

    if (triggerTasks.trigger) {
      const handle = await triggerTasks.trigger(taskId, payload);
      if (handle.wait) {
        const completed = await handle.wait();
        return (
          (completed as { output?: Output }).output ?? (completed as Output)
        );
      }
    }
  } catch (error) {
    if (process.env.TRIGGER_REQUIRED === "true") {
      throw error;
    }
  }

  return fallback(payload);
}
