import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import {
  listUsersSchema,
  suspendUserSchema,
  listCompaniesSchema,
  listJobsSchema,
  listComplaintsSchema,
  resolveComplaintSchema,
} from "../schemas/admin.schema.js";
import { notify } from "../services/notification.service.js";
import { cached, cacheDel } from "../lib/cache.js";
import { invalidateJobCaches } from "../services/jobCache.service.js";

const ADMIN_STATS_KEY = "admin:stats";
const ADMIN_STATS_TTL_SECONDS = 60;

async function computeStats() {
  const [totalUsers, totalCandidates, totalRecruiters, totalCompanies, pendingCompanies, totalJobs, publishedJobs, totalApplications, openComplaints] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "CANDIDATE" } }),
      prisma.user.count({ where: { role: "RECRUITER" } }),
      prisma.company.count(),
      prisma.company.count({ where: { isApproved: false } }),
      prisma.job.count(),
      prisma.job.count({ where: { status: "PUBLISHED" } }),
      prisma.application.count(),
      prisma.complaint.count({ where: { status: "OPEN" } }),
    ]);

  return { totalUsers, totalCandidates, totalRecruiters, totalCompanies, pendingCompanies, totalJobs, publishedJobs, totalApplications, openComplaints };
}

export async function listUsers(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed = listUsersSchema.safeParse(req.query);

      if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid query", errors: parsed.error.flatten().fieldErrors });
      }

      const {role, isSuspended, search, page, limit}= parsed.data;

      const where: any={};
      if(role) where.role=role;
      if(isSuspended !== undefined) where.isSuspended= isSuspended;

      if(search)
      {
        where.OR= [{name: {contains: search, mode: "insensitive"}},
            {email: {contains: search, mode: "insensitive"}}
        ]
      }

      const skip=(page-1)*limit;
      const [users, total]= await Promise.all([
        prisma.user.findMany({
            where,
            select: {id: true, name: true, email: true, role: true, isSuspended: true, isEmailVerified: true,createdAt: true},
            orderBy: {createdAt: "desc"},
            skip,
            take: limit
        }),
        prisma.user.count({where})
      ]);

      return res.status(200).json({
        success: true,
        data: { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
        });
    }
    catch(err)
    {
        next(err);
    }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed = suspendUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const userId= req.params.id as string;

      if(userId=== req.user!.userId)
      {
        return res.status(400).json({ success: false, message: "You can't suspend your own account" });
      }

      const target= await prisma.user.findUnique({where: {id: userId}});

      if(!target)
      {
        return res.status(404).json({success: false, message: "User not found" })
      }
      if(target.role === "ADMIN")
      {
        return res.status(403).json({success: false, meesage: "Admins can't suspend other admins"})
      }

      await prisma.$transaction([
        prisma.user.update({where: {id: userId}, data:{isSuspended: true}}),
        prisma.refreshToken.deleteMany({where:{userId}})
      ]);

      return res.status(200).json({success: true, message: "User suspended"})
    }
    catch(err)
    {
        next(err);
    }
}

export async function unsuspendUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id as string;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await prisma.user.update({ where: { id: userId }, data: { isSuspended: false } });
    return res.status(200).json({ success: true, message: "User unsuspended" });
  } catch (err) {
    next(err);
  }
}

export async function listCompanies(req: Request, res: Response, next: NextFunction)
{
  try{
   const parsed = listCompaniesSchema.safeParse(req.query);

   if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid query", errors: parsed.error.flatten().fieldErrors });
    }
   
    const {isApproved, page, limit}= parsed.data;
    const where: any={};

    if(isApproved !== undefined) where.isApproved= isApproved;
    const skip= (page-1)*limit;

    const [companies, total]= await Promise.all([
      prisma.company.findMany({where, include: {recruiter: {select: {name: true, email: true}}, _count: {select: {jobs: true}}},
      orderBy: {createdAt: "desc"},
      skip,
      take: limit
      })
      ,prisma.company.count({where})]);

     return res.status(200).json({success: true,data: {companies, pagination: {page, limit, total, totalPages: Math.ceil(total/limit)}}}) 
  }
  catch(err)
  {
    next(err);
  }
}

export async function approveCompany(req: Request, res: Response, next: NextFunction)
{
  try{
   const id= req.params.id as string;

   const company= await prisma.company.findUnique({where: {id}});

   if(!company)
   {
    return res.status(404).json({success: false, message: "Company not found"})
   }
   const updated= await prisma.company.update({where: {id}, data: {isApproved: true}});

   await invalidateJobCaches();
   await cacheDel(ADMIN_STATS_KEY);

   await notify({
      userId: company.recruiterId,
      type: "COMPANY_APPROVED",
      title: "Company approved",
      message: `${company.name} has been approved. You can now publish jobs.`,
      link: "/recruiter/jobs",
      email: {},
    });

   return res.status(200).json({success: true, data: {company: updated}})
  }
  catch(err)
  {
    next(err);
  }
}

export async function rejectCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const updated = await prisma.company.update({ where: { id }, data: { isApproved: false } });
    await invalidateJobCaches();
    await cacheDel(ADMIN_STATS_KEY);
    await notify({
      userId: company.recruiterId,
      type: "COMPANY_REJECTED",
      title: "Company approval revoked",
      message: `Approval for ${company.name} was revoked, so you can't publish new jobs until it's approved again.`,
      link: "/recruiter/company",
      email: {},
    });
    return res.status(200).json({ success: true, data: { company: updated } });
  } catch (err) {
    next(err);
  }
}

export async function listAllJobs(req: Request, res: Response, next: NextFunction)
{
  try{
   const parsed = listJobsSchema.safeParse(req.query);
   if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid query", errors: parsed.error.flatten().fieldErrors });
    }

    const {status, page, limit}= parsed.data;
    const where: any={};

    if(status) where.status=status;
    const skip= (page-1)*limit;

    const [jobs, total]= await Promise.all([
      prisma.job.findMany({
        where,
        include: {company: {select: {name: true, recruiterId: true}}},
        orderBy: {createdAt: "desc"},
        skip,
        take: limit
      }),
      prisma.job.count({where})
    ]);

    return res.status(200).json({success: true, data: {jobs, pagination: {page, limit, total, totalPages: Math.ceil(total/limit)}}})
  }
  catch(err)
  {
    next(err);
  }
}

export async function removeJob(req: Request, res: Response, next: NextFunction)
{
  try{
    const id= req.params.id as string;

    const job= await prisma.job.findUnique({ where: { id }, include: { company: true } });

    if(!job)
    {
      return res.status(404).json({success: false, message: "Job not found"});
    }
    const updated= await prisma.job.update({where: {id}, data: {status: "CLOSED"}});

    await invalidateJobCaches();
    await cacheDel(ADMIN_STATS_KEY);

    await notify({
      userId: job.company.recruiterId,
      type: "JOB_REMOVED",
      title: "Job closed by an administrator",
      message: `Your job "${job.title}" was closed by an administrator for moderation reasons.`,
      link: "/recruiter/jobs",
      email: {},
    });

    return res.status(200).json({success: true, data: {job: updated}})
  }
  catch(err)
  {
    next(err);
  }
}

export async function listComplaints(req: Request, res: Response, next: NextFunction)
{
  try{
    const parsed = listComplaintsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid query", errors: parsed.error.flatten().fieldErrors });
    }

    const {status, page, limit}= parsed.data;

    const where:any={};
    if(status) where.status=status;

    const skip=(page-1)*limit;

    const [complaints, total]= await Promise.all([
      prisma.complaint.findMany({where,
        include: {reporter: {select: {name: true, email: true}}},
        skip,
        take: limit
      }),
      prisma.complaint.count({where})
    ]);

    return res.status(200).json({success: true, data: {complaints, pagination: {page, limit, total, totalPages: Math.ceil(total/limit)}}})
  }
  catch(err)
  {
    next(err);
  }
}

export async function resolveComplaint(req: Request, res: Response, next: NextFunction)
{
  try{
    const parsed = resolveComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
    }

    const id= req.params.id as string;
    const complaint= await prisma.complaint.findUnique({where: {id}});

    if(!complaint)
    {
      return res.status(404).json({success: false, message: "Complaint not found"})
    }

    const updated= await prisma.complaint.update({where: {id}, data: {...parsed.data, resolvedAt: new Date()}});

    await cacheDel(ADMIN_STATS_KEY);
    return res.status(200).json({success: true, data: {complaint: updated}})
  }
  catch(err)
  {
    next(err);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const { data, status } = await cached(ADMIN_STATS_KEY, ADMIN_STATS_TTL_SECONDS, computeStats);
    res.setHeader("X-Cache", status);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}