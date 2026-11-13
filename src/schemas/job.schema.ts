import {z} from "zod";

export const createJobSchema= z.object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(20, "Job description must be at least 20 characters"),
    skills: z.array(z.string().trim().min(1)).min(1, "Add at least one skill"),
    location: z.string().trim().min(2).max(200),
    workMode: z.enum(["REMOTE", "ONSITE", "HYBRID"]),
    employmentType: z.string().trim().min(2).max(50),
    salaryMin: z.number().int().positive().optional(),
    salaryMax: z.number().int().positive().optional(),
    experienceMin: z.number().int().min(0).optional(),
    experienceMax: z.number().int().min(0).optional(),
})

export const updateJobSchema= createJobSchema.partial();

export const jobSearchSchema= z.object({
    search: z.string().trim().optional(),
    location: z.string().trim().optional(),
    workMode: z.enum(["REMOTE", "ONSITE", "HYBRID"]).optional(),
    employmentType: z.string().trim().optional(),
    skill: z.string().trim().optional(),
    experienceMin: z.coerce.number().int().min(0).optional(),
    experienceMax: z.coerce.number().int().min(0).optional(),
    salaryMin: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
})

export type CreateJobInput= z.infer<typeof createJobSchema>
export type UpdateJobInput= z.infer<typeof updateJobSchema>
export type JobSearchInput= z.infer<typeof jobSearchSchema>