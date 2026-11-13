import {z} from "zod";

export const registerSchema=z.object({
    role: z.enum(["CANDIDATE", "RECRUITER"], {
    message: "Role must be either CANDIDATE or RECRUITER",
  }),

  name: z.string().trim().min(2, "Name must be at least 2 characters long")
  .max(100, "Name is too long"),

  email: z.string().trim().toLowerCase().email("Enter a valid email address"),

  password: z.string().min(8, "Password must be at least 8 characters long")
  .max(72, "Password is too long")
});

export const loginSchema=z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

export const forgotPasswordSchema= z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address")
})

export const resetPasswordSchema= z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72)
})

export const verifyEmailSchema= z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().min(1, "Verification token is required")
})

export const resendVerificationSchema= z.object({
  email: z.string().trim().toLowerCase().email()
})

export type RegisterInput=z.infer<typeof registerSchema>;
export type LoginInput=z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;