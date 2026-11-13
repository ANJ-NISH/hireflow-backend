import {z} from "zod";

export const createCompanySchema= z.object({
    name: z.string().trim().min(2, "Company name must be at least 2 characters").max(150),
    description: z.string().trim().max(2000).optional(),
    website: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
    logoUrl: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
})

export const updateCompanySchema= createCompanySchema.partial() 

export type CreateCompanyInput= z.infer<typeof createCompanySchema>
export type UpdateCompanyInput= z.infer<typeof updateCompanySchema>