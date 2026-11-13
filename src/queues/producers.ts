import { emailQueue, reminderQueue, type EmailJobData } from "./index.js";
import { sendEmail } from "../utils/mailer.js";

const LEAD_MS = Number(process.env.INTERVIEW_REMINDER_LEAD_MINUTES ?? 1440) * 60_000;
const reminderJobId = (interviewId: string) => `interview-reminder-${interviewId}`; 

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  try {
    await withTimeout(emailQueue.add("send-email", data), 2000);
  } catch (err) {
    console.error("[queue] Could not enqueue email, sending inline:", (err as Error).message);
    sendEmail(data.to, data.subject, data.html).catch((e) => console.error("[email] inline send failed:", e));
  }
}

export async function cancelInterviewReminder(interviewId: string): Promise<void> {
  try {
    const job = await withTimeout(reminderQueue.getJob(reminderJobId(interviewId)), 2000);
    if (job) await job.remove();
  } catch (err) {
    console.error("[queue] Could not remove interview reminder:", (err as Error).message);
  }
}

export async function syncInterviewReminder(interview: {
  id: string;
  scheduledAt: Date;
  status: string;
}): Promise<void> {
  await cancelInterviewReminder(interview.id);

  if (interview.status !== "SCHEDULED") return;

  const delay = interview.scheduledAt.getTime() - LEAD_MS - Date.now();
  if (delay <= 0) return; 

  try {
    await withTimeout(
      reminderQueue.add(
        "interview-reminder",
        { interviewId: interview.id, scheduledAt: interview.scheduledAt.toISOString() },
        { delay, jobId: reminderJobId(interview.id) }
      ),
      2000
    );
  } catch (err) {
    console.error("[queue] Could not schedule interview reminder:", (err as Error).message);
  }
}