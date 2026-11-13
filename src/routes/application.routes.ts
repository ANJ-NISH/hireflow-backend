import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import {
  applyToJob,
  listMyApplications,
  getMyApplicationById,
  withdrawApplication,
  listApplicantsForJob,
  updateApplicationStatus,
} from "../controllers/application.controller.js";
import { getApplicantResumeDownloadUrl } from "../controllers/resume.controller.js";
import { applyLimiter } from "../middlewares/limiters.js";

const router=Router();

router.post("/jobs/:jobId/apply", requireAuth, requireRole("CANDIDATE"), applyLimiter, applyToJob);
router.get("/mine", requireAuth, requireRole("CANDIDATE"), listMyApplications);
router.get("/:id", requireAuth, requireRole("CANDIDATE"), getMyApplicationById);
router.post("/:id/withdraw", requireAuth, requireRole("CANDIDATE"), withdrawApplication);

router.get("/jobs/:jobId/applicants", requireAuth, requireRole("RECRUITER"), listApplicantsForJob);
router.patch("/:id/status", requireAuth, requireRole("RECRUITER"), updateApplicationStatus);

router.get("/:applicationId/resume-download-url", requireAuth, requireRole("RECRUITER"), getApplicantResumeDownloadUrl);

export default router;