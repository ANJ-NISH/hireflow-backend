import crypto from "crypto";
import type { Request, RequestHandler } from "express";
import { hit, reset } from "../lib/rateLimitStore.js";

const ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";

type Options = {
  name: string;
  limit: number;
  windowSeconds: number;
  key: (req: Request) => string | null;
  message?: string;
};

export function clientIp(req: Request): string {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function hashId(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

const keyFor = (name: string, id: string) => `rl:${name}:${id}`;

export function clearRateLimit(name: string, id: string): Promise<void> {
  return reset(keyFor(name, id));
}

function humanize(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function rateLimit(options: Options): RequestHandler {
  const { name, limit, windowSeconds, message } = options;
  const windowMs = windowSeconds * 1000;

  return async (req, res, next) => {
    if (!ENABLED) return next();

    let id: string | null;
    try {
      id = options.key(req);
    } catch (err) {
      console.error(`[rate-limit] ${name}: key function failed, skipping`, err);
      return next();
    }
    if (id === null) return next();

    const { count, ttlMs } = await hit(keyFor(name, id), windowMs);
    const resetSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - count)));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (count > limit) {
      res.setHeader("Retry-After", String(resetSeconds));
      return res.status(429).json({
        success: false,
        message: `${message ?? "Too many requests."} Please try again in ${humanize(resetSeconds)}.`,
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };
}