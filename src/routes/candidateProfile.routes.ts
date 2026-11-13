import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import {
  getMyProfile,
  updateMyProfile,
  addExperience,
  updateExperience,
  deleteExperience,
  addEducation,
  updateEducation,
  deleteEducation,
  addCertification,
  deleteCertification,
  addProject,
  deleteProject,
  getProfileByUserId,
} from "../controllers/candidateProfile.controller.js";

const router = Router();

router.get("/me", requireAuth, requireRole("CANDIDATE"), getMyProfile);
router.patch("/me", requireAuth, requireRole("CANDIDATE"), updateMyProfile);

router.post("/me/experience", requireAuth, requireRole("CANDIDATE"), addExperience);
router.patch("/me/experience/:id", requireAuth, requireRole("CANDIDATE"), updateExperience);
router.delete("/me/experience/:id", requireAuth, requireRole("CANDIDATE"), deleteExperience);

router.post("/me/education", requireAuth, requireRole("CANDIDATE"), addEducation);
router.patch("/me/education/:id", requireAuth, requireRole("CANDIDATE"), updateEducation);
router.delete("/me/education/:id", requireAuth, requireRole("CANDIDATE"), deleteEducation);

router.post("/me/certifications", requireAuth, requireRole("CANDIDATE"), addCertification);
router.delete("/me/certifications/:id", requireAuth, requireRole("CANDIDATE"), deleteCertification);

router.post("/me/projects", requireAuth, requireRole("CANDIDATE"), addProject);
router.delete("/me/projects/:id", requireAuth, requireRole("CANDIDATE"), deleteProject);

router.get("/:userId", requireAuth, requireRole("RECRUITER"), getProfileByUserId);

export default router;