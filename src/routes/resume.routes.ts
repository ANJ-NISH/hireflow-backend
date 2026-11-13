import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import {
  requestUploadUrl,
  confirmUpload,
  listMyResumes,
  setPrimaryResume,
  deleteResume,
  getMyResumeDownloadUrl,
} from "../controllers/resume.controller.js";
import { uploadUrlLimiter } from "../middlewares/limiters.js";

const router = Router();

router.use(requireAuth, requireRole("CANDIDATE"));

router.post("/upload-url", uploadUrlLimiter, requestUploadUrl);
router.post("/confirm", confirmUpload);
router.get("/mine", listMyResumes);
router.post("/:id/set-primary", setPrimaryResume);
router.delete("/:id", deleteResume);
router.get("/:id/download-url", getMyResumeDownloadUrl);

export default router;