import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { getUploadUrl, getDownloadUrl, headObject, deleteObject } from "../lib/s3.js";
import { requestUploadUrlSchema, confirmUploadSchema, MAX_RESUMES_PER_CANDIDATE, MAX_FILE_SIZE_BYTES } from "../schemas/resume.schema.js";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export async function requestUploadUrl(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed= requestUploadUrlSchema.safeParse(req.body);

      if(!parsed.success)
      {
        return res.status(400).json({success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors});
      }

      const candidateId= req.user!.userId;

      const existingCount= await prisma.resume.count({where: {candidateId}});

      if(existingCount >= MAX_RESUMES_PER_CANDIDATE)
      {
        return res.status(400).json({success: false, message: `You can only keep up to ${MAX_RESUMES_PER_CANDIDATE} resumes. 
        Delete one before adding another.`})
      }

      const {filename, contentType}= parsed.data;
      const storageKey = `resumes/${candidateId}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;

      const uploadUrl= await getUploadUrl(storageKey, contentType);
      return res.status(200).json({success: true, data: {uploadUrl, storageKey}});
    }
    catch(err)
    {
        next(err);
    }
}

export async function confirmUpload(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed = confirmUploadSchema.safeParse(req.body);

      if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const candidateId= req.user!.userId;
      const {storageKey, originalFilename}= parsed.data;

      if (!storageKey.startsWith(`resumes/${candidateId}/`)) {
      return res.status(403).json({ success: false, message: "This file doesn't belong to you" });
      }

      let head;
      try{
        head=await headObject(storageKey);
        if ((head.ContentLength ?? 0) > MAX_FILE_SIZE_BYTES) {
          await deleteObject(storageKey); // don't leave the oversized file sitting in the bucket
          return res.status(400).json({ success: false, message: "File must be 5MB or smaller" });
        }
      }
      catch{
        return res.status(400).json({ success: false, message: "Upload not found — the file may not have uploaded successfully" });
      }

      const resume = await prisma.resume.create({
      data: {
        candidateId,
        originalFilename,
        storageKey,
        mimeType: head.ContentType || "application/octet-stream",
        sizeBytes: head.ContentLength || 0,
      },
      });

       const resumeCount = await prisma.resume.count({ where: { candidateId } });
        if (resumeCount === 1) {
        await prisma.resume.update({ where: { id: resume.id }, data: { isPrimary: true } });
        resume.isPrimary = true;
        }

        return res.status(201).json({ success: true, data: { resume } });
        }
    catch(err)
    {
        next(err);
    }
}

export async function listMyResumes(req: Request, res: Response, next: NextFunction) {
  try {
    const resumes = await prisma.resume.findMany({
      where: { candidateId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: { resumes } });
  } catch (err) {
    next(err);
  }
}

export async function setPrimaryResume(req: Request, res: Response, next: NextFunction)
{
    try{
      const id= req.params.id as string;
      const candidateId= req.user!.userId;

      const resume= await prisma.resume.findUnique({where: {id}});

      if(!resume || resume.candidateId !== candidateId)
      {
        return res.status(404).json({success: false, message: "Resume not found"})
      }

      await prisma.$transaction([
        prisma.resume.updateMany({where: {candidateId}, data: {isPrimary: false}}),
        prisma.resume.update({where: {id}, data: {isPrimary: true}})
      ]);
      return res.status(200).json({ success: true, message: "Primary resume updated" });
    }
    catch(err){
        next(err);
    }
}

export async function deleteResume(req: Request, res: Response, next: NextFunction)
{
    try{
      const id= req.params.id as string;
      const candidateId= req.user!.userId;

      const resume= await prisma.resume.findUnique({where: {id}});

      if(!resume || resume.candidateId !== candidateId)
      {
        return res.status(404).json({success: false, message: "Resume not found"})
      }

      await deleteObject(resume.storageKey);
      await prisma.resume.delete({where: {id}});

      if(resume.isPrimary)
      {
        const next= await prisma.resume.findFirst({where: {candidateId}, orderBy: {createdAt: "desc"}});
        if(next)
        {
         await prisma.resume.update({where: {id: next.id}, data: {isPrimary: true}})
        }
      }

      return res.status(200).json({ success: true, message: "Resume deleted" });
    }
    catch(err)
    {
        next(err);
    }
}


export async function getMyResumeDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const resume = await prisma.resume.findUnique({ where: { id } });

    if (!resume || resume.candidateId !== req.user!.userId) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    const url = await getDownloadUrl(resume.storageKey);
    return res.status(200).json({ success: true, data: { downloadUrl: url } });
  } catch (err) {
    next(err);
  }
}

export async function getApplicantResumeDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = req.params.applicationId as string;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { include: { company: true } }, resume: true },
    });

    if (!application || application.job.company.recruiterId !== req.user!.userId) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }
    if (!application.resume) {
      return res.status(404).json({ success: false, message: "No resume attached to this application" });
    }

    const url = await getDownloadUrl(application.resume.storageKey);
    return res.status(200).json({ success: true, data: { downloadUrl: url, filename: application.resume.originalFilename } });
  } catch (err) {
    next(err);
  }
}