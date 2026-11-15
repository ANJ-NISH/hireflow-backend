import type { Request, Response, NextFunction } from "express";
import {prisma} from "../lib/prisma.js";
import {
  candidateSearchSchema,
  addNoteSchema,
  scheduleInterviewSchema,
  updateInterviewSchema,
} from "../schemas/recruiterTools.schema.js";
import { notify } from "../services/notification.service.js";
import { syncInterviewReminder } from "../queues/producers.js";
import { formatUtc } from "../utils/format.js";

async function getOwnedApplicationOrFail(applicationId: string, recruiterId: string)
{
    const application= await prisma.application.findUnique({
        where: {id: applicationId},
        include: {job: {include: {company: true}}}
    });

    if(!application || application.job.company.recruiterId !== recruiterId)
    {
        return null;
    }
    return application;
}

export async function searchCandidates(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed= candidateSearchSchema.safeParse(req.query);
      if(!parsed.success)
      {
        return res.status(400).json({success: false, message: "Invalid search parameters", errors: parsed.error.flatten().fieldErrors})
      }

      const {skill, location, experienceMin, experienceMax, page, limit}=parsed.data;

      const where: any = { isSearchable: true, user: { isSuspended: false } };
      if(skill){
        where.skills= {has: skill}
      };
      if(location){
        where.location= {contains: location, mode: "insensitive"};
      }
      if(experienceMin !== undefined || experienceMax !== undefined)
      {
        where.totalExperienceYears={}
        if(experienceMin!== undefined){
            where.totalExperienceYears.gte= experienceMin;
        }
        if(experienceMax!== undefined){
            where.totalExperienceYears.lte=experienceMax;
        }
      }

      const skip=(page-1)*limit;

      const [profiles, total] = await Promise.all([
      prisma.candidateProfile.findMany({
        where,
        select: {
          id: true,
          userId: true,
          headline: true,
          location: true,
          skills: true,
          languages: true,
          totalExperienceYears: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.candidateProfile.count({ where }),
    ]);

      return res.status(200).json({success: true, data: {profiles, pagination:{page, limit,total, totalPages: Math.ceil(total/ limit)}}})
    }
    catch(err)
    {
        next(err);
    }
}

export async function listNotes(req: Request, res: Response, next: NextFunction)
{
    try{
     
        const applicationId= req.params.applicationId as string;
        const application= await getOwnedApplicationOrFail(applicationId, req.user!.userId);
        if(!application)
        {
            return res.status(404).json({success: false, message: "Application not found"})
        }

        const notes= await prisma.applicationNote.findMany({
            where: {applicationId},
            include: {recruiter: {select: {name: true}}},
            orderBy: {createdAt: "desc"}
        });

        return res.status(200).json({success: true, data:{notes}})
    }
    catch(err)
    {
        next(err);
    }
}


export async function addNote(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed= addNoteSchema.safeParse(req.body);
      if(!parsed.success)
      {
        return res.status(400).json({success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors})
      }

      const applicationId= req.params.applicationId as string;
      const application= await getOwnedApplicationOrFail(applicationId, req.user!.userId);

      if(!application)
      {
        return res.status(404).json({success: false, message: "Application not found"})
      }

      const note= await prisma.applicationNote.create({data: {applicationId,recruiterId: req.user!.userId, note:parsed.data.note},
      include: {recruiter: {select: {name:true}}}
    });

    return res.status(201).json({success: true, data: {note}})
    }
    catch(err)
    {
        next(err);
    }
}

export async function deleteNote(req: Request, res:Response, next: NextFunction)
{
    try{
      const noteId= req.params.id as string;

      const note= await prisma.applicationNote.findUnique({where: {id: noteId}});

      if(!note || note.recruiterId !== req.user!.userId)
      {
        return res.status(404).json({success: false, message: "Note not found"})
      }

      await prisma.applicationNote.delete({where: {id: noteId}});

      return res.status(200).json({success: true, message: "Note deleted"})
    }
    catch(err)
    {
        next(err);
    }
}

export async function listInterviews(req: Request, res: Response, next: NextFunction)
{
    try{
    const applicationId = req.params.applicationId as string;
    const application = await getOwnedApplicationOrFail(applicationId, req.user!.userId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const interviews = await prisma.interview.findMany({
      where: { applicationId },
      orderBy: { scheduledAt: "asc" },
    });

    return res.status(200).json({ success: true, data: { interviews } });
    }
    catch(err)
    {
        next(err);
    }
}


export async function scheduleInterview(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed = scheduleInterviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

    const applicationId = req.params.applicationId as string;
    const application = await getOwnedApplicationOrFail(applicationId, req.user!.userId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const interview = await prisma.interview.create({
      data: { ...parsed.data, applicationId },
    });

    await syncInterviewReminder(interview);

    await notify({
      userId: application.candidateId,
      type: "INTERVIEW_SCHEDULED",
      title: "Interview scheduled",
      message: `An interview has been scheduled for ${application.job.title} at ${application.job.company.name}.`,
      link: "/candidate/applications",
      data: { interviewId: interview.id, scheduledAt: interview.scheduledAt.toISOString(), mode: interview.mode },
      email: {
        detail: `When: ${formatUtc(interview.scheduledAt)} · Mode: ${interview.mode}${interview.locationOrUrl ? ` · ${interview.locationOrUrl}` : ""}`,
      },
    });

    if (application.status === "APPLIED" || application.status === "SCREENING" || application.status === "SHORTLISTED") {
      await prisma.application.update({ where: { id: applicationId }, data: { status: "INTERVIEW" } });
    }

    return res.status(201).json({ success: true, data: { interview } });
    }
    catch(err)
    {
        next(err);
    }
}

export async function updateInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateInterviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
    }

    const interviewId = req.params.id as string;
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { job: { include: { company: true } } } } },
    });

    if (!interview || interview.application.job.company.recruiterId !== req.user!.userId) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    const updated = await prisma.interview.update({ where: { id: interviewId }, data: parsed.data });
    
    await syncInterviewReminder(updated);

    const timeChanged = parsed.data.scheduledAt && parsed.data.scheduledAt.getTime() !== interview.scheduledAt.getTime();
    const nowCancelled = parsed.data.status === "CANCELLED" && interview.status !== "CANCELLED";
    const { job } = interview.application;

    if (nowCancelled) {
      await notify({
        userId: interview.application.candidateId,
        type: "INTERVIEW_CANCELLED",
        title: "Interview cancelled",
        message: `Your interview for ${job.title} at ${job.company.name} was cancelled.`,
        link: "/candidate/applications",
        email: {},
      });
    } else if (timeChanged) {
      await notify({
        userId: interview.application.candidateId,
        type: "INTERVIEW_RESCHEDULED",
        title: "Interview rescheduled",
        message: `Your interview for ${job.title} at ${job.company.name} was rescheduled.`,
        link: "/candidate/applications",
        data: { interviewId: updated.id, scheduledAt: updated.scheduledAt.toISOString() },
        email: { detail: `New time: ${formatUtc(updated.scheduledAt)}` },
      });
    }

    return res.status(200).json({ success: true, data: { interview: updated } });
  } catch (err) {
    next(err);
  }
}

export async function cancelInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const interviewId = req.params.id as string;
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { job: { include: { company: true } } } } },
    });

    if (!interview || interview.application.job.company.recruiterId !== req.user!.userId) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    const updated = await prisma.interview.update({ where: { id: interviewId }, data: { status: "CANCELLED" } });
    
    await syncInterviewReminder(updated);

    if (interview.status !== "CANCELLED") {
      const { job } = interview.application;
      await notify({
        userId: interview.application.candidateId,
        type: "INTERVIEW_CANCELLED",
        title: "Interview cancelled",
        message: `Your interview for ${job.title} at ${job.company.name} was cancelled.`,
        link: "/candidate/applications",
        email: {},
      });
    }
    
    return res.status(200).json({ success: true, data: { interview: updated } });
  } catch (err) {
    next(err);
  }
}