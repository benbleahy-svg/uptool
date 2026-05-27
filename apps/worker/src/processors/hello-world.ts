import type { Job } from "bullmq";
import { logger } from "../logger";

export async function helloWorldProcessor(job: Job) {
  logger.info({ jobId: job.id }, "Hello from BullMQ — worker is wired up correctly");
}
