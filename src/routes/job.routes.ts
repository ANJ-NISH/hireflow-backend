import {Router} from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import {
    createJob,
    updateJob,
    publishJob,
    pauseJob,
    closeJob,
    deleteJob,
    listMyJobs,
    searchJobs,
    getJobById
} from "../controllers/job.controller.js";

const router= Router();

router.get("/", searchJobs);

router.post("/",requireAuth, requireRole("RECRUITER"), createJob);
router.get("/mine",requireAuth, requireRole("RECRUITER"), listMyJobs);
router.patch("/:id",requireAuth, requireRole("RECRUITER"), updateJob);
router.post("/:id/publish",requireAuth, requireRole("RECRUITER"), publishJob);
router.post("/:id/pause",requireAuth, requireRole("RECRUITER"), pauseJob);
router.post("/:id/close",requireAuth, requireRole("RECRUITER"), closeJob);
router.delete("/:id",requireAuth, requireRole("RECRUITER"), deleteJob);

router.get("/:id", getJobById);

export default router;