import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { complaintLimiter } from "../middlewares/limiters.js";
import { createComplaint } from "../controllers/complaint.controller.js";

const router = Router();

router.post("/", requireAuth, complaintLimiter, createComplaint);

export default router;