import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { listNotificationsSchema } from "../schemas/notification.schema.js";

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listNotificationsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid query", errors: parsed.error.flatten().fieldErrors });
    }

    const { unreadOnly, page, limit } = parsed.data;
    const userId = req.user!.userId;
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    });
    return res.status(200).json({ success: true, data: { unreadCount } });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { count } = await prisma.notification.updateMany({
      where: { id, userId: req.user!.userId },
      data: { isRead: true },
    });

    if (count === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.status(200).json({ success: true, message: "Marked as read" });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    return res.status(200).json({ success: true, data: { updated: count } });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { count } = await prisma.notification.deleteMany({
      where: { id, userId: req.user!.userId },
    });

    if (count === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
}