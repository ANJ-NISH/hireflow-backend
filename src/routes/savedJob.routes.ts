import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { saveJob, unsaveJob, listSavedJobs, checkIfSaved } from "../controllers/savedJob.controller.js";

const router=Router();

router.use(requireAuth, requireRole("CANDIDATE"));

router.get("/", listSavedJobs);
router.post("/:jobId", saveJob);
router.delete("/:jobId", unsaveJob);
router.get("/:jobId/check", checkIfSaved);

export default router;