import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { recentlyViewedLimiter } from "../middlewares/limiters.js";
import {
  recordView,
  listRecentlyViewed,
  removeRecentlyViewed,
  clearRecentlyViewed,
} from "../controllers/recentlyViewed.controller.js";

const router = Router();

router.use(requireAuth, requireRole("CANDIDATE"));

router.get("/", listRecentlyViewed);
router.post("/:jobId", recentlyViewedLimiter, recordView);
router.delete("/", clearRecentlyViewed);
router.delete("/:jobId", removeRecentlyViewed);

export default router;