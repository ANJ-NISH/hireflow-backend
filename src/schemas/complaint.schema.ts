import { z } from "zod";

export const createComplaintSchema = z.object({
  targetType: z.enum(["JOB", "USER", "COMPANY"]),
  targetId: z.string().uuid("Invalid target ID"),
  reason: z.string().trim().min(10, "Please describe the issue in a bit more detail").max(1000),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;