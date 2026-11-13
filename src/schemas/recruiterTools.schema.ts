import {z} from "zod";

export const candidateSearchSchema= z.object({
    skill: z.string().trim().optional(),
    location: z.string().trim().optional(),
    experienceMin: z.coerce.number().int().min(0).optional(),
    experienceMax: z.coerce.number().int().min(0).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
})

export const addNoteSchema= z.object({
    note: z.string().trim().min(1, "Note can't be empty").max(2000),
})

export const scheduleInterviewSchema= z.object({
    scheduledAt: z.coerce.date(),
    mode: z.enum(["ONLINE", "ONSITE", "PHONE"]),
    locationOrUrl: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional()
})

export const updateInterviewSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  mode: z.enum(["ONLINE", "ONSITE", "PHONE"]).optional(),
  locationOrUrl: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

export type CandidateSearchInput = z.infer<typeof candidateSearchSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;