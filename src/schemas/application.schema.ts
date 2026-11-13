import {z} from "zod";

export const applyToJobSchema= z.object({
    resumeId: z.string().uuid().optional(),
    coverLetter: z.string().trim().max(3000, "Cover letter is too long").optional()
});

export type ApplyToJobInput= z.infer<typeof applyToJobSchema>;

export const updateApplicationStatusSchema= z.object({
    status: z.enum(["SCREENING", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED", "REJECTED"]),
});

export type UpdateApplicationStatusInput= z.infer<typeof updateApplicationStatusSchema>;