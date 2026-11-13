import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { EMAIL_QUEUE, type EmailJobData } from "../queues/index.js";
import { sendEmail } from "../utils/mailer.js";

export function startEmailWorker() {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE,
    async (job) => {
      await sendEmail(job.data.to, job.data.subject, job.data.html);
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("completed", (job) => console.log(`[email] job ${job.id} done`));
  worker.on("failed", (job, err) =>
    console.error(`[email] job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`, err.message)
  );
  worker.on("error", (err) => console.error("[email] worker error:", err.message));

  return worker;
}