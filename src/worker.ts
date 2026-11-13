import "dotenv/config";
import { startEmailWorker } from "./workers/email.worker.js";
import { startReminderWorker } from "./workers/reminder.worker.js";

const workers = [startEmailWorker(), startReminderWorker()];
console.log("Workers running: email, interview-reminders");

async function shutdown(signal: string) {
  console.log(`${signal} received, closing workers...`);
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));