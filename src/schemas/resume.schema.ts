import { z } from "zod";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; 
export const MAX_RESUMES_PER_CANDIDATE = 5;

export const requestUploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(255),

  contentType: z.enum(ALLOWED_MIME_TYPES, {
    error: "Only PDF and Word documents are allowed",
  }),

  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, "File must be 5MB or smaller"),
});

export const confirmUploadSchema = z.object({
  storageKey: z.string().min(1),
  originalFilename: z.string().trim().min(1).max(255),
});

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;