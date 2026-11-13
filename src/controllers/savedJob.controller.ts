import type { Request, Response, NextFunction } from "express";
import {prisma} from "../lib/prisma.js";

export async function saveJob(req:Request, res: Response, next: NextFunction)
{
    try{
      const jobId= req.params.jobId as string;
      const candidateId= req.user!.userId;

      const job= await prisma.job.findUnique({where: {id: jobId}});

      if(!job || job.status!== "PUBLISHED")
      {
        return res.status(404).json({success: false, message: "Job not found" })
      }

      const saved= await prisma.savedJob.upsert({
        where: {jobId_candidateId: {jobId, candidateId}},
        update: {},
        create: {jobId, candidateId}
      });

      return res.status(201).json({success: true, data: {savedJob: saved}})
    }
    catch(err)
    {
        next(err);
    }
}

export async function unsaveJob(req: Request, res: Response, next: NextFunction)
{
    try{
      const jobId=req.params.jobId as string;
      const candidateId= req.user!.userId;

      await prisma.savedJob.deleteMany({where: {jobId, candidateId}});

      return res.status(200).json({ success: true, message: "Job removed from saved list" });
    }
    catch(err)
    {
        next(err);
    }
}

export async function listSavedJobs(req: Request, res: Response, next: NextFunction)
{
    try{
      const savedJobs= await prisma.savedJob.findMany({
        where: {candidateId: req.user!.userId},
        include:{job: {include: {company: {select: {name: true, logoUrl: true}}}}},
        orderBy: {createdAt: "desc"}
      });

      const active=savedJobs.filter((s)=> s.job.status === "PUBLISHED");

      return res.status(200).json({success: true, data: {savedJobs: active}});
    }
    catch(err)
    {
        next(err);
    }
}

export async function checkIfSaved(req: Request, res: Response, next: NextFunction)
{
    try{
     const jobId= req.params.jobId as string;
     const candidateId= req.user!.userId;

     const saved= await prisma.savedJob.findUnique({where: {jobId_candidateId: {jobId, candidateId}}});

     return res.status(200).json({success: true, data: {isSaved: !!saved}})
    }
    catch(err)
    {
        next(err);
    }
}