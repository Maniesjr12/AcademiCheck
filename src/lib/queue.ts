import { Queue } from "bullmq";
import redis from "@/lib/redis";

export class QueueError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "QueueError";
  }
}

// Singleton queue — survives Next.js hot reloads in development.
const globalForQueue = globalThis as unknown as {
  _detectionQueue: Queue | undefined;
};

function getQueue(): Queue {
  if (!globalForQueue._detectionQueue) {
    globalForQueue._detectionQueue = new Queue("detection", {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return globalForQueue._detectionQueue;
}

export async function addDetectionJob(submissionId: string): Promise<void> {
  try {
    await getQueue().add("detect", { submissionId });
  } catch (err) {
    throw new QueueError(
      `Failed to queue detection job for submission ${submissionId}`,
      err
    );
  }
}
