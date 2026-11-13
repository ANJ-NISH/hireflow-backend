import type { Request } from "express";
import { rateLimit, clientIp, hashId, clearRateLimit } from "./rateLimit.js";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

const byIp = (req: Request) => clientIp(req);

const byUser = (req: Request) => (req.user ? `user:${req.user.userId}` : `ip:${clientIp(req)}`);

function emailOf(req: Request): string | null {
  const email = req.body?.email;
  return typeof email === "string" && email.trim() !== "" ? email : null;
}


export const globalLimiter = rateLimit({
  name: "global",
  limit: 300,
  windowSeconds: MINUTE,
  key: byIp,
  message: "Too many requests.",
});


export const registerLimiter = rateLimit({
  name: "register",
  limit: 5,
  windowSeconds: HOUR,
  key: byIp,
  message: "Too many accounts created from this network.",
});

export const loginIpLimiter = rateLimit({
  name: "login-ip",
  limit: 30,
  windowSeconds: 15 * MINUTE,
  key: byIp,
  message: "Too many login attempts.",
});

export const loginAccountLimiter = rateLimit({
  name: "login-account",
  limit: 5,
  windowSeconds: 15 * MINUTE,
  key: (req) => {
    const email = emailOf(req);
    return email ? `${clientIp(req)}|${hashId(email)}` : null;
  },
  message: "Too many failed login attempts for this account.",
});

export function clearLoginFailures(req: Request, email: string): Promise<void> {
  return clearRateLimit("login-account", `${clientIp(req)}|${hashId(email)}`);
}

export const refreshLimiter = rateLimit({
  name: "refresh",
  limit: 120,
  windowSeconds: 15 * MINUTE,
  key: byIp,
  message: "Too many session refreshes.",
});

export const tokenActionLimiter = rateLimit({
  name: "token-action",
  limit: 10,
  windowSeconds: HOUR,
  key: byIp,
  message: "Too many attempts.",
});

function emailActionLimiters(name: string) {
  return [
    rateLimit({
      name: `${name}-ip`,
      limit: 5,
      windowSeconds: HOUR,
      key: byIp,
      message: "Too many requests from this network.",
    }),
    rateLimit({
      name: `${name}-email`,
      limit: 3,
      windowSeconds: HOUR,
      key: (req) => {
        const email = emailOf(req);
        return email ? hashId(email) : null;
      },
      message: "Too many requests for this email address.",
    }),
  ];
}

export const forgotPasswordLimiters = emailActionLimiters("forgot-password");
export const resendVerificationLimiters = emailActionLimiters("resend-verification");


export const uploadUrlLimiter = rateLimit({
  name: "upload-url",
  limit: 20,
  windowSeconds: HOUR,
  key: byUser,
  message: "Too many upload requests.",
});

export const applyLimiter = rateLimit({
  name: "apply",
  limit: 30,
  windowSeconds: HOUR,
  key: byUser,
  message: "You're applying to jobs very quickly.",
});

export const complaintLimiter = rateLimit({
  name: "complaint",
  limit: 10,
  windowSeconds: HOUR,
  key: byUser,
  message: "Too many complaints submitted.",
});