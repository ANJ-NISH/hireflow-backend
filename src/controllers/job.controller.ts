import type {Request, Response, NextFunction} from "express";
import {prisma} from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import {createJobSchema, updateJobSchema, jobSearchSchema} from "../schemas/job.schema.js";
import { stableKey } from "../lib/cache.js";
import {
  cachedJobs,
  invalidateJobCaches,
  JOB_LIST_TTL_SECONDS,
  JOB_DETAIL_TTL_SECONDS,
} from "../services/jobCache.service.js";
import type { JobSearchInput } from "../schemas/job.schema.js";

const MAX_CACHED_PAGE = 5;

async function runFilterSearch(input: JobSearchInput) {
  const { search, location, workMode, employmentType, skill, experienceMin, experienceMax, salaryMin, page, limit } = input;

  const where: Prisma.JobWhereInput = { status: "PUBLISHED" };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (location) where.location = { contains: location, mode: "insensitive" };
  if (workMode) where.workMode = workMode;
  if (employmentType) where.employmentType = { contains: employmentType, mode: "insensitive" };
  if (skill) where.skills = { has: skill };
  if (salaryMin) where.salaryMax = { gte: salaryMin };
  if (experienceMin !== undefined) where.experienceMax = { gte: experienceMin };
  if (experienceMax !== undefined) where.experienceMin = { lte: experienceMax };

  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: { company: { select: { name: true, logoUrl: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

const likePattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

async function runFullTextSearch(input: JobSearchInput, search: string) {
  const { location, workMode, employmentType, skill, experienceMin, experienceMax, salaryMin, sort, page, limit } = input;

  const tsq = Prisma.sql`websearch_to_tsquery('english', search_normalize(${search}))`;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`j.status = 'PUBLISHED'`,
    Prisma.sql`j.search_vector @@ ${tsq}`,
  ];
  if (location) conditions.push(Prisma.sql`j.location ILIKE ${likePattern(location)}`);
  if (workMode) conditions.push(Prisma.sql`j."workMode" = ${workMode}::"WorkMode"`);
  if (employmentType) conditions.push(Prisma.sql`j."employmentType" ILIKE ${likePattern(employmentType)}`);
  if (skill) conditions.push(Prisma.sql`${skill} = ANY(j.skills)`); 
  if (salaryMin) conditions.push(Prisma.sql`j."salaryMax" >= ${salaryMin}::int`);
  if (experienceMin !== undefined) conditions.push(Prisma.sql`j."experienceMax" >= ${experienceMin}::int`);
  if (experienceMax !== undefined) conditions.push(Prisma.sql`j."experienceMin" <= ${experienceMax}::int`);

  const where = Prisma.join(conditions, " AND ");

  const orderBy =
    sort === "newest"
      ? Prisma.sql`j."createdAt" DESC, j.id DESC`
      : Prisma.sql`ts_rank(j.search_vector, ${tsq}) DESC, j."createdAt" DESC, j.id DESC`;

  const skip = (page - 1) * limit;

  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT j.id FROM jobs j
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${limit}::int OFFSET ${skip}::int
    `),
    prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT count(*)::int AS count FROM jobs j WHERE ${where}
    `),
  ]);

  const total = counts[0]?.count ?? 0;
  const ids = rows.map((r) => r.id);

  const jobs = ids.length
    ? await prisma.job.findMany({
        where: { id: { in: ids } },
        include: { company: { select: { name: true, logoUrl: true } } },
      })
    : [];

  const position = new Map(ids.map((id, i) => [id, i]));
  jobs.sort((a, b) => position.get(a.id)! - position.get(b.id)!);

  return { jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function runJobSearch(input: JobSearchInput) {
  if (input.search) {
    const ranked = await runFullTextSearch(input, input.search);
    if (ranked.pagination.total > 0) return ranked;
  }
  return runFilterSearch(input);
}

async function getOwnedCompanyOrFail(userId: string, res: Response) {
   
    const company= await prisma.company.findUnique({where: {recruiterId: userId}});

    if(!company){
        res.status(404).json({success: false, message: "Create a company profile before posting jobs"});
        return null;
    }
    return company;
}

export async function createJob(req: Request, res: Response, next: NextFunction) {
    try{

        const parsed= createJobSchema.safeParse(req.body);

        if(!parsed.success)
        {
            return res.status(400).json({success: false, message: "Validation error", errors: parsed.error.flatten().fieldErrors})
        }

        const company= await getOwnedCompanyOrFail(req.user!.userId, res);
        if(!company) return;

        const job= await prisma.job.create({
            data:{
                ...parsed.data,
                companyId: company.id
            }
        });

        return res.status(201).json({success: true, data: {job}});
    }
    catch(err){
        next(err);
    }
}

export async function updateJob(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed= updateJobSchema.safeParse(req.body);

      if(!parsed.success)
      {
        return res.status(400).json({success: false, message: "Validation Error", errors: parsed.error.flatten().fieldErrors})
      }

      const jobId = req.params.id as string;
      const job = await prisma.job.findUnique({ where: { id: jobId }, include: { company: true } });

      if(!job)
      {
        return res.status(404).json({success: false, message: "Job not found"});
      }
      
      if(job.company.recruiterId !== req.user!.userId)
      {
        return res.status(403).json({success: false, message: "You don't own this job"});
      }

      const updated= await prisma.job.update({where: {id: job.id}, data: parsed.data});
      await invalidateJobCaches();

      return res.status(200).json({success: true, data: {updated}});

    }
    catch(err)
    {
       next(err);
    }
}

function setJobStatus(status: "PUBLISHED" | "PAUSED" | "CLOSED"){

    return async(req: Request, res: Response, next: NextFunction)=>{

        try{
        const jobId=req.params.id as string;
        const job= await prisma.job.findUnique({where: {id: jobId}, include: {company: true}});

        if(!job)
        {
            return res.status(404).json({success: true, message: "Job not found"});
        }

        if(job.company.recruiterId !== req.user!.userId)
        {
            return res.status(403).json({success: false, message:"You don't own this job"})
        }

        if (status === "PUBLISHED" && !job.company.isApproved) {
            return res.status(403).json({ success: false, message: "Your company must be approved by an admin before publishing jobs" });
        }

        const updated= await prisma.job.update({where: {id: job.id}, data: {status}});
        await invalidateJobCaches();
        return res.status(200).json({success: true, data: {job: updated}})
    }
    catch(err)
    {
        next(err);
    }
    } 
}

export const publishJob = setJobStatus("PUBLISHED");
export const pauseJob = setJobStatus("PAUSED");
export const closeJob = setJobStatus("CLOSED");

export async function deleteJob(req: Request, res:Response, next: NextFunction)
{
    try{

       const jobId= req.params.id as string;
       const job= await prisma.job.findUnique({where: {id: jobId}, include:{company: true}});

       if(!job)
       {
        return res.status(404).json({success: false, message: "Job not found"});
       }

       if(job.company.recruiterId !== req.user!.userId)
       {
        return res.status(403).json({success: true, message: "You don't own this job"});
       }

       await prisma.job.delete({where: {id: job.id}});
       await invalidateJobCaches();
       return res.status(200).json({success: true, message: "Job deleted"})
    }
    catch(err)
    {
        next(err);
    }
}

export async function listMyJobs(req: Request, res: Response, next: NextFunction)
{
    try{

        const company= await getOwnedCompanyOrFail(req.user!.userId, res);

        if(!company)
        {
          return;
        }

        const jobs= await prisma.job.findMany({
          where: {companyId: company.id},
          orderBy: {createdAt: "desc"}
        }  
        );

        return res.status(200).json({
            success: false,
            data: {jobs}
        })
    }
    catch(err)
    {
        next(err);
    }

}

export async function searchJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = jobSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid search parameters", errors: parsed.error.flatten().fieldErrors });
    }
    
    const input: JobSearchInput = {
      ...parsed.data,
      sort: parsed.data.search && parsed.data.sort === "newest" ? "newest" : undefined,
    };
    const run = () => runJobSearch(input);

    const { data, status } =
      input.page <= MAX_CACHED_PAGE
        ? await cachedJobs(
            `search:${stableKey(input, { lowercase: ["search", "location", "employmentType"] })}`,
            JOB_LIST_TTL_SECONDS,
            run
          )
        : { data: await run(), status: "BYPASS" as const };

    res.setHeader("X-Cache", status);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getJobById(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.id as string;

    const { data: job, status } = await cachedJobs(`detail:${jobId}`, JOB_DETAIL_TTL_SECONDS, async () => {
      const found = await prisma.job.findUnique({ where: { id: jobId }, include: { company: true } });
      return found && found.status === "PUBLISHED" ? found : null;
    });

    res.setHeader("X-Cache", status);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    return res.status(200).json({ success: true, data: { job } });
  } catch (err) {
    next(err);
  }
}