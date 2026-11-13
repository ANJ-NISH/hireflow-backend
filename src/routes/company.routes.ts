import {Router} from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { createCompany, getMyCompany, updateMyCompany } from "../controllers/company.controller.js";

const router=Router();

router.use(requireAuth, requireRole("RECRUITER"));

router.post("/", createCompany);
router.get("/me", getMyCompany);
router.patch("/me", updateMyCompany);

export default router;