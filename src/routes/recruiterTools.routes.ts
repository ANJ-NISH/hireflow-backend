import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import {
  searchCandidates,
  listNotes,
  addNote,
  deleteNote,
  listInterviews,
  scheduleInterview,
  updateInterview,
  cancelInterview,
} from "../controllers/recruiterTools.controller.js";

const router = Router();

router.use(requireAuth, requireRole("RECRUITER"));

router.get("/candidates/search", searchCandidates);

router.get("/applications/:applicationId/notes", listNotes);
router.post("/applications/:applicationId/notes", addNote);
router.delete("/notes/:id", deleteNote);

router.get("/applications/:applicationId/interviews", listInterviews);
router.post("/applications/:applicationId/interviews", scheduleInterview);
router.patch("/interviews/:id", updateInterview);
router.post("/interviews/:id/cancel", cancelInterview);

export default router;