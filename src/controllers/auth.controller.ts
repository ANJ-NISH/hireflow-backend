import type {Request, Response, NextFunction} from "express";
import bcrypt from "bcrypt";
import {prisma} from "../lib/prisma.js";
import {registerSchema, loginSchema, forgotPasswordSchema, resendVerificationSchema, verifyEmailSchema
    , resetPasswordSchema
} from "../schemas/auth.schema.js";
import {signAccessToken, signRefreshToken, verifyRefreshToken,
    hashToken, REFRESH_TOKEN_MAX_AGE_MS, generateRawToken
} from "../utils/jwt.js";
import { enqueueEmail } from "../queues/producers.js";
import { escapeHtml } from "../utils/format.js";
import { clearLoginFailures } from "../middlewares/limiters.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const EMAIL_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_MAX_AGE_MS = 60 * 60 * 1000;

const SALT_ROUNDS=12;

const REFRESH_TOKEN_COOKIE_OPTIONS={
    httpOnly: true,
    secure: false,
    sameSite: "strict" as const,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: "/api/auth"
}

async function sendVerificationEmail(userId: string, email: string, name: string)
{
    const rawToken= generateRawToken();
    const tokenHash= hashToken(rawToken);

      await prisma.user.update({
        where: { id: userId },
        data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_MAX_AGE_MS),
        },
    });

    const link = `${FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&token=${rawToken}`;

    await enqueueEmail({
    to: email,
    subject: "Verify your HireFlow email",
    html: `<p>Hi ${escapeHtml(name)},</p><p>Confirm your email address to finish setting up your account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
    });
}

async function issueTokens(res: Response, userId: string, role: "CANDIDATE" | "RECRUITER" | "ADMIN")
{
    const accessToken=signAccessToken({userId, role});
    const refreshToken=signRefreshToken({userId, role});

    await prisma.refreshToken.create({
        data:{
            userId,
            tokenHash: hashToken(refreshToken),
            expiresAt: new Date(Date.now()+REFRESH_TOKEN_MAX_AGE_MS)
        }
    });

    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    return accessToken;
}


export async function registerUser(
    req: Request,
    res: Response,
    next: NextFunction
)
{
    try{
        const parsed=registerSchema.safeParse(req.body);
        if(!parsed.success)
        {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors
            })
        }

        const {role, name, email, password}=parsed.data;

        const existingUser=await prisma.user.findUnique({where: {email}});

        if(existingUser)
        {
            return res.status(409).json({
                success: false,
                message: "User with this email already exists"
            })
        }

        const passwordHash= await bcrypt.hash(password, SALT_ROUNDS);

        const user=await prisma.user.create({
            data:{name, email, passwordHash, role},
            select: {id: true, name: true, email: true, role: true, createdAt: true},
        })

        const accessToken= await issueTokens(res, user.id, user.role);

        sendVerificationEmail(user.id, user.email, user.name).catch((err) =>
        console.error("Failed to send verification email:", err)
        );

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {user, accessToken},
        });
    }
    catch(err){
        next(err);
    }
}


export async function loginUser(
    req: Request,
    res: Response,
    next: NextFunction
)
{
    try{
        const parsed=loginSchema.safeParse(req.body);
        if(!parsed.success)
        {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors
            })
        }

        const {email, password}=parsed.data;

        const user= await prisma.user.findUnique({where: {email}});

        if(!user)
        {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            })
        }

        const isPasswordValid= await bcrypt.compare(password, user.passwordHash);

        if(!isPasswordValid)
        {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            })
        }
        await clearLoginFailures(req, email); 

        if (user.isSuspended) {
        return res.status(403).json({ success: false, message: "This account has been suspended. Contact support for details." });
        }

        const accessToken= await issueTokens(res, user.id, user.role);

        return res.status(200).json({
            success: true,
            message: "Logged In successfully",
            data:{
                user:
                {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt
                },
                accessToken,
            }
        })
    }
    catch(err){
        next(err);
    }
}


export async function refreshAccessToken(req: Request, res: Response, next:NextFunction)
{
    try{
        const refreshToken= req.cookies?.refreshToken;

        if(!refreshToken){
            return res.status(401).json({success: false, message: "No refresh token provided"});
        }
    
        let payload;
        try{
            payload=verifyRefreshToken(refreshToken);
        }
        catch
        {
            return res.status(401).json({success: false,message: "Invalid or expired refresh token"});
        }

        const tokenHash=hashToken(refreshToken);
        const stored= await prisma.refreshToken.findFirst({where:
            {userId: payload.userId, tokenHash, expiresAt: {gt: new Date()}}});
        
        if(!stored)
            {
                return res.status(401).json({success: false, message: "Refresh token has been revoked"});
            }  
            
         await prisma.refreshToken.delete({where: {id: stored.id}});
         const accessToken= await issueTokens(res, payload.userId, payload.role);
         
         return res.status(200).json({success: true, data: {accessToken}});
    }
    catch(err)
    {
        next(err);
    }
}

export async function logoutUser(req: Request, res: Response, next: NextFunction)
{
    try{
        const refreshToken=req.cookies?.refreshToken;
        if(refreshToken)
        {
            const tokenHash=hashToken(refreshToken);
            await prisma.refreshToken.deleteMany({where: {tokenHash}})
        }
        res.clearCookie("refreshToken", {path: "/api/auth"});
        return res.status(200).json({success: true, message: "Logout successful"})
    }
    catch(err)
    {
        next(err);
    }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed= verifyEmailSchema.safeParse(req.body);

      if(!parsed.success)
      {
        return res.status(400).json({success: false, message: "Validation failed", errors:
            parsed.error.flatten().fieldErrors
        })
      }

      const {email, token}= parsed.data;

      const tokenHash= hashToken(token);
      
      const user= await prisma.user.findFirst({
        where: {
            email,
            emailVerificationTokenHash: tokenHash,
            emailVerificationExpires: {gt: new Date()}
        }
      });

      if(!user)
      {
        return res.status(400).json({success: false, message: "Invalid or expired verification link"})
      }

      await prisma.user.update({
        where: {id: user.id},
        data: {
            isEmailVerified: true,
            emailVerificationTokenHash: null,
            emailVerificationExpires: null
        }
      });

      return res.status(200).json({success: true, message: "Email verified successfully"})

    }
    catch(err)
    {
        next(err);
    }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction)
{
    try{
       const parsed = resendVerificationSchema.safeParse(req.body);

        if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
        }

        const user= await prisma.user.findUnique({where: {email: parsed.data.email}});

        if(user && !user.isEmailVerified)
        {
            sendVerificationEmail(user.id, user.email, user.name).catch((err)=>
            console.error("Failed to resend verification email:", err)
        )
        }

        return res.status(200).json({
        success: true,
        message: "If an account with that email exists and isn't verified yet, a new link has been sent.",
        });
    }
    catch(err)
    {
        next(err);
    }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction){
    try{
      const parsed = forgotPasswordSchema.safeParse(req.body);

      if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const user= await prisma.user.findUnique({where: {email: parsed.data.email}});

      if(user)
      {
        const rawToken= generateRawToken();
        const tokenHash= hashToken(rawToken);

        await prisma.user.update({where: {id: user.id},
        data:{
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_MAX_AGE_MS)
        }});

        const link = `${FRONTEND_URL}/reset-password?email=${encodeURIComponent(user.email)}&token=${rawToken}`;

        void enqueueEmail({
        to: user.email,
        subject: "Reset your HireFlow password",
        html: `<p>Hi ${escapeHtml(user.name)},</p><p>Click below to reset your password. This link expires in 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
        });
    }
    catch(err)
    {
        next(err);
    }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed = resetPasswordSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }
      
      const {email, token, newPassword}= parsed.data;
      const tokenHash= hashToken(token);

      const user= await prisma.user.findFirst({
        where:{
            email,
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: {gt: new Date()}
        }
      })

      if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
      }

      const passwordHash= await bcrypt.hash(newPassword, SALT_ROUNDS);

      await prisma.$transaction([
        prisma.user.update({
            where: {id: user.id},
            data:{
                passwordHash,
                passwordResetTokenHash: null,
                passwordResetExpires: null
            }
        }),
        prisma.refreshToken.deleteMany({where: {userId: user.id}})
      ])

      return res.status(200).json({ success: true, message: "Password reset successfully. Please log in again." });
    }
    catch(err)
    {
        next(err);
    }
}