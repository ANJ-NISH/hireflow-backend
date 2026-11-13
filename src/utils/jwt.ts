import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

if(!JWT_SECRET) throw new Error("JWT_SECRET is not defined in the environment variables.");
if(!JWT_REFRESH_SECRET) throw new Error("JWT_REFRESH_SECRET is not defined in the environment variables.");

export type JwtPayload={
    userId: string;
    role:  "CANDIDATE" | "RECRUITER" | "ADMIN";
}

export function signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {expiresIn: "15m"});
}

export function signRefreshToken(payload: JwtPayload): string{
    return jwt.sign(payload, JWT_REFRESH_SECRET, {expiresIn: "7d"});
}

export function verifyAccessToken(token: string): JwtPayload{
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload{
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}

export function hashToken(token: string): string{
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRawToken(): string{
    return crypto.randomBytes(32).toString("hex");
}

export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;