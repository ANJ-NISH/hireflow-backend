import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", listNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/read-all", markAllAsRead);
router.post("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;