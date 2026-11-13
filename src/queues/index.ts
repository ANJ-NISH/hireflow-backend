import {Queue} from "bullmq";
import { redisConnection } from "../lib/redis.js";

export const EMAIL_QUEUE="email";
export const REMINDER_QUEUE="interview-reminders";

export type EmailJobData= {to: string; subject: string; html: string};
export type ReminderJobData= {interviewId: string; scheduledAt: string};

const defaultJobOptions={
    attempts: 5,
    backoff: {type: "exponential" as const, delay: 5000},
    removeOnComplete: {age: 60*60, count: 1000},
    removeOnFail: {age: 7*24*60*60}
}

export const emailQueue= new Queue<EmailJobData>(EMAIL_QUEUE,{
    connection: redisConnection,
    defaultJobOptions
});

export const reminderQueue= new Queue<ReminderJobData>(REMINDER_QUEUE,{
    connection: redisConnection,
    defaultJobOptions
})