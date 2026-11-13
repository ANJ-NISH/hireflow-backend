import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import {
  registerLimiter,
  loginIpLimiter,
  loginAccountLimiter,
  refreshLimiter,
  tokenActionLimiter,
  forgotPasswordLimiters,
  resendVerificationLimiters,
} from "../middlewares/limiters.js";

const router = Router();

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginIpLimiter, loginAccountLimiter, loginUser);
router.post("/refresh", refreshLimiter, refreshAccessToken);
router.post("/logout", logoutUser);

router.post("/verify-email", tokenActionLimiter, verifyEmail);
router.post("/resend-verification", ...resendVerificationLimiters, resendVerification);
router.post("/forgot-password", ...forgotPasswordLimiters, forgotPassword);
router.post("/reset-password", tokenActionLimiter, resetPassword);

export default router;