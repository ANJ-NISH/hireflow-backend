import { z } from "zod";

const queryBoolean = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const listUsersSchema = z.object({
  role: z.enum(["CANDIDATE", "RECRUITER", "ADMIN"]).optional(),
  isSuspended: queryBoolean,
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const suspendUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const listCompaniesSchema = z.object({
  isApproved: queryBoolean,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const listJobsSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "PAUSED", "CLOSED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const listComplaintsSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const resolveComplaintSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  adminNote: z.string().trim().max(1000).optional(),
});