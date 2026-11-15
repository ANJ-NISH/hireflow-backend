import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { REMINDER_QUEUE, type ReminderJobData } from "../queues/index.js";
import { notify } from "../services/notification.service.js";
import { formatUtc } from "../utils/format.js";

export function startReminderWorker() {
  const worker = new Worker<ReminderJobData>(
    REMINDER_QUEUE,
    async (job) => {
      const { interviewId, scheduledAt } = job.data;

      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        include: {
          application: {
            include: {
              job: { include: { company: true } },
              candidate: { select: { name: true } },
            },
          },
        },
      });
      
      if (!interview || interview.status !== "SCHEDULED") return;
      if (interview.scheduledAt.toISOString() !== scheduledAt) return;

      const { application } = interview;
      if (application.status === "WITHDRAWN" || application.status === "REJECTED") return;
      const jobTitle = application.job.title;
      const when = `When: ${formatUtc(interview.scheduledAt)}`;
      const data = { interviewId, scheduledAt };

      await notify({
        userId: application.candidateId,
        type: "INTERVIEW_REMINDER",
        title: "Interview reminder",
        message: `Your interview for ${jobTitle} is coming up soon.`,
        link: "/candidate/applications",
        data,
        email: { detail: when },
      });

      await notify({
        userId: application.job.company.recruiterId,
        type: "INTERVIEW_REMINDER",
        title: "Interview reminder",
        message: `Your interview with ${application.candidate.name} for ${jobTitle} is coming up soon.`,
        link: `/recruiter/jobs/${application.jobId}/applicants`,
        data,
        email: { detail: when },
      });
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => console.error(`[reminder] job ${job?.id} failed:`, err.message));
  worker.on("error", (err) => console.error("[reminder] worker error:", err.message));

  return worker;
}