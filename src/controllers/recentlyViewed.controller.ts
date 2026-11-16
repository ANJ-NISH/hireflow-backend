import type { Request, Response, NextFunction } from "express";
import {z} from "zod";
import { prisma } from "../lib/prisma.js";

const MAX_HISTORY= 20;

const listSchema= z.object({
    limit: z.coerce.number().int().positive().max(MAX_HISTORY).default(12),
})

async function trimHistory(candidateId: string)
{
    try{
       const overflow= await prisma.recentlyViewedJob.findMany({
        where: {candidateId},
        orderBy: {viewedAt: "desc"},
        skip: MAX_HISTORY,
        select: {id: true}
       });

       if(overflow.length> 0)
       {
        await prisma.recentlyViewedJob.deleteMany({
            where: {id: {in: overflow.map((r)=> r.id)}}
        })
       }
    }
    catch(err)
    {
      console.error("[recently-viewed] trim failed:", err);
    }
}

export async function recordView(req: Request, res: Response, next: NextFunction)
{
    try{
      const jobId= req.params.jobId as string;
      const candidateId= req.user!.userId;

      const job= await prisma.job.findUnique({where: {id: jobId}, select: {status: true}});

      if(!job || job.status !== "PUBLISHED")
      {
        return res.status(404).json({success: false, message: "Job not found"});
      }

      await prisma.recentlyViewedJob.upsert({
        where: {jobId_candidateId: {jobId, candidateId}},
        update: {viewedAt: new Date()},
        create: {jobId, candidateId}
      });

      await trimHistory(candidateId);

      return res.status(200).json({success: true, message: "View Recorded"})
    }
    catch(err)
    {
        next(err);
    }
}

export async function listRecentlyViewed(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed= listSchema.safeParse(req.query);

      if(!parsed.success)
      {
        return res.status(400).json({success: false, message: "Invalid query", errors: parsed.error.flatten().fieldErrors})
      }

      const recentlyViewed= await prisma.recentlyViewedJob.findMany({
        where:{
            candidateId: req.user!.userId,
            job: {status: "PUBLISHED"}
        },
        include: { job: { include: { company: { select: { name: true, logoUrl: true } } } } },
        orderBy: {viewedAt: "desc"},
        take: parsed.data.limit
      });

      return res.status(200).json({ success: true, data: { recentlyViewed } });
    }
    catch(err)
    {
        next(err);
    }
}

export async function removeRecentlyViewed(req: Request, res: Response, next: NextFunction) 
{
    try{
      const jobId= req.params.jobId as string;

      await prisma.recentlyViewedJob.deleteMany({where: {jobId, candidateId: req.user!.userId}});

      return res.status(200).json({ success: true, message: "Removed from history" });
    }
    catch(err)
    {
        next(err);
    }
}

export async function clearRecentlyViewed(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.recentlyViewedJob.deleteMany({ where: { candidateId: req.user!.userId } });
    return res.status(200).json({ success: true, message: "History cleared" });
  } catch (err) {
    next(err);
  }
}