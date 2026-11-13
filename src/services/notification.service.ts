import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { enqueueEmail } from "../queues/producers.js";
import { escapeHtml } from "../utils/format.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string; 
  data?: Prisma.InputJsonValue;
  email?: { detail?: string }; 
};

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true, email: true, isSuspended: true },
    });
    if (!user) return;

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        data: input.data,
      },
    });

    if (input.email && !user.isSuspended) {
      const url = `${FRONTEND_URL}${input.link ?? ""}`;
      const detail = input.email.detail ? `<p>${escapeHtml(input.email.detail)}</p>` : "";

      await enqueueEmail({
        to: user.email,
        subject: input.title,
        html: `<p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(input.message)}</p>${detail}<p><a href="${url}">View in HireFlow</a></p>`,
      });
    }
  } catch (err) {
    console.error("[notify] failed:", err);
  }
}