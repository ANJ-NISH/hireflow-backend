import { Request, Response, NextFunction, application } from "express";
import { prisma } from "../lib/prisma.js";
import { applyToJobSchema,updateApplicationStatusSchema } from "../schemas/application.schema.js";
import { notify } from "../services/notification.service.js";

export async function applyToJob(req: Request, res: Response, next: NextFunction){

    try{
       const parsed= applyToJobSchema.safeParse(req.body);

       if(!parsed.success)
       {
        return res.status(400).json({success: false, message: "Validation Error", errors: parsed.error.flatten().fieldErrors});
       }
       
       const jobId= req.params.jobId as string;
       const candidateId= req.user!.userId;

       const job = await prisma.job.findUnique({ where: { id: jobId }, include: { company: true } });

       if(!job || job.status !== "PUBLISHED")
       {
        return res.status(404).json({success: false, message: "Job not found"});
       }

       const existing= await prisma.application.findUnique({where: {jobId_candidateId:{jobId, candidateId}
       }});

       if(existing)
       {
        if(existing.status === "WITHDRAWN")
        {
            const reapplied= await prisma.application.update({
                where: {id: existing.id},
                data: {status: "APPLIED", ...parsed.data}
            });
            await notifyNewApplication(job, candidateId);

            return res.status(200).json({success: true, data: {application: reapplied}})
        }
        return res.status(409).json({success: false, message: "You have already applied to this job"})
       }

       if (parsed.data.resumeId) {
        const resume = await prisma.resume.findUnique({ where: { id: parsed.data.resumeId } });
        if (!resume || resume.candidateId !== candidateId) {
          return res.status(400).json({ success: false, message: "Invalid resume selected" });
        }
       }

       const application= await prisma.application.create({
        data:{jobId, candidateId, ...parsed.data}
       });
       await notifyNewApplication(job, candidateId);

       return res.status(201).json({success: true, data: {application}});
    }
    catch(err)
    {
        next(err);
    }
}

export async function listMyApplications(req: Request, res:Response, next: NextFunction)
{
    try{
      const applications= await prisma.application.findMany({
        where: {candidateId: req.user!.userId},
        include:{
            job:{
                select:{
                    id: true,
                    title: true,
                    location: true,
                    workMode: true,
                    status: true,
                    company: {select: {name: true, logoUrl: true}}
                }
            },
            interviews: {
              select: { id: true, scheduledAt: true, mode: true, locationOrUrl: true, status: true },
              orderBy: { scheduledAt: "asc" },
            },
        },
        orderBy: {createdAt: "desc"}
      });

      return res.status(200).json({success: true, data: {applications}});
    }
    catch(err)
    {
        next(err);
    }
}

export async function getMyApplicationById(req: Request, res: Response, next: NextFunction)
{
    try{
      const applicationId= req.params.id as string;

      const application= await prisma.application.findUnique({
        where: {id: applicationId},
        include: {job: {include: {company: true}}}
      });

      if(!application || application.candidateId !== req.user!.userId)
      {
        return res.status(404).json({success: false, message: "Application not found"});
      }

      return res.status(200).json({success: true, data: {application}});
    }
    catch(err){
       next(err);
    }
}

export async function withdrawApplication(req: Request, res: Response, next: NextFunction)
{
    try{
       const applicationId= req.params.id as string;

       const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: { job: { include: { company: true } } },
       });

       if(!application || application.candidateId !== req.user!.userId)
       {
        return res.status(404).json({success: false, message: "Application not found"});
       }

       if(["HIRED", "REJECTED", "WITHDRAWN"].includes(application.status))
       {
        return res.status(409).json({success: false, message: `Cannot withdraw an application that is already ${application.status.toLowerCase()}`})
       }

       const updated= await prisma.application.update({
        where: {id: applicationId},
        data: {status : "WITHDRAWN"}
       });

       await notify({
        userId: application.job.company.recruiterId,
        type: "APPLICATION_WITHDRAWN",
        title: "Application withdrawn",
        message: `An applicant withdrew their application for ${application.job.title}.`,
        link: `/recruiter/jobs/${application.jobId}/applicants`,
      });

       return res.status(200).json({success: true, data: {application: updated}})
    }
    catch(err)
    {
        next(err);
    }
}

export async function listApplicantsForJob(req: Request, res: Response, next: NextFunction)
{
    try{
      const jobId= req.params.jobId as string;

      const job= await prisma.job.findUnique({where: {id: jobId}, include: {company: true}});

      if(!job)
      {
        return res.status(404).json({success: false, message:"Job not found"});
      }

      if(job.company.recruiterId !== req.user!.userId)
      {
        return res.status(403).json({success: false, message: "You don't own this job"});
      }

      const applications= await prisma.application.findMany({
        where: {jobId},
        include: {candidate: {select: {id: true, name: true, email: true}}},
        orderBy: {createdAt: "desc"}
      });

      return res.status(200).json({success: true, data: {applications}});
    }
    catch(err)
    {
        next(err);
    }
}


export async function updateApplicationStatus(req: Request, res: Response, next: NextFunction)
{
   try
   {
     const parsed= updateApplicationStatusSchema.safeParse(req.body);

     if(!parsed.success)
     {
        return res.status(400).json({success: false, message: "Validation Error", errors:
            parsed.error.flatten().fieldErrors
        });
     }

     const applicationId= req.params.id as string;

     const application= await prisma.application.findUnique({
        where: {id: applicationId},
        include: {job: {include: {company: true}}}
     });

     if(!application)
     {
        return res.status(404).json({success: false, message: "Application not found"})
     }
     if(application.job.company.recruiterId !== req.user!.userId)
     {
        return res.status(403).json({success: false, message: "You don't own this job"})
     }
     if(application.status === "WITHDRAWN")
     {
        return res.status(400).json({ success: false, message: "Cannot update a withdrawn application" });
     }

     const updated= await prisma.application.update({
        where: {id: applicationId},
        data: {status: parsed.data.status}
     });

      if (application.status !== parsed.data.status) {
      await notify({
        userId: application.candidateId,
        type: "APPLICATION_STATUS_CHANGED",
        title: "Application update",
        message: `Your application for ${application.job.title} at ${application.job.company.name} was updated to ${parsed.data.status}.`,
        link: "/candidate/applications",
        data: { applicationId, status: parsed.data.status },
        email: ["OFFERED", "HIRED", "REJECTED"].includes(parsed.data.status) ? {} : undefined,
      });
    }

     return res.status(200).json({success: true, data: {application: updated}})
   }
   catch(err)
   {
    next(err);
   }
}

async function notifyNewApplication(
  job: { id: string; title: string; company: { recruiterId: string } },
  candidateId: string
) {
  try {
    const candidate = await prisma.user.findUnique({ where: { id: candidateId }, select: { name: true } });
    await notify({
      userId: job.company.recruiterId,
      type: "APPLICATION_RECEIVED",
      title: "New application",
      message: `${candidate?.name ?? "A candidate"} applied for ${job.title}.`,
      link: `/recruiter/jobs/${job.id}/applicants`,
    });
  } catch (err) {
    console.error("[notify] new application failed:", err);
  }
}