import { z } from "zod";

export const updateProfileSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  bio: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  skills: z.array(z.string().trim().min(1)).max(50).optional(),
  languages: z.array(z.string().trim().min(1)).max(20).optional(),
  resumeUrl: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  totalExperienceYears: z.coerce.number().int().min(0).max(60).optional()
});

export const experienceSchema = z.object({
  title: z.string().trim().min(2).max(150),
  company: z.string().trim().min(2).max(150),
  location: z.string().trim().max(100).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  isCurrent: z.boolean().default(false),
  description: z.string().trim().max(2000).optional(),
});

export const educationSchema = z.object({
  institution: z.string().trim().min(2).max(150),
  degree: z.string().trim().min(2).max(150),
  fieldOfStudy: z.string().trim().max(150).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const certificationSchema = z.object({
  name: z.string().trim().min(2).max(150),
  issuer: z.string().trim().min(2).max(150),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  url: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
});

export const projectSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional(),
  url: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  techStack: z.array(z.string().trim().min(1)).max(30).default([]),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;