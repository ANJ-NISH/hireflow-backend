import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import {
  listUsers,
  suspendUser,
  unsuspendUser,
  listCompanies,
  approveCompany,
  rejectCompany,
  listAllJobs,
  removeJob,
  listComplaints,
  resolveComplaint,
  getStats,
} from "../controllers/admin.controller.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/stats", getStats);

router.get("/users", listUsers);
router.post("/users/:id/suspend", suspendUser);
router.post("/users/:id/unsuspend", unsuspendUser);

router.get("/companies", listCompanies);
router.post("/companies/:id/approve", approveCompany);
router.post("/companies/:id/reject", rejectCompany);

router.get("/jobs", listAllJobs);
router.post("/jobs/:id/remove", removeJob);

router.get("/complaints", listComplaints);
router.patch("/complaints/:id/resolve", resolveComplaint);

export default router;