import type { Request, Response, NextFunction } from "express";
import {prisma} from "../lib/prisma.js";
import { updateProfileSchema, experienceSchema, certificationSchema, 
    projectSchema, educationSchema } from "../schemas/candidateProfile.schema.js";


async function getOrCreateProfile(userId: string) {
  return prisma.candidateProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getMyProfile(req: Request, res: Response, next: NextFunction)
{
    try{
      const profile= await getOrCreateProfile(req.user!.userId);

      const full= await prisma.candidateProfile.findUnique({where: {id: profile.id},
      include: {
        experiences: {orderBy: {startDate: "desc"}},
        educations: {orderBy: {startDate: "desc"}},
        certifications: {orderBy: {issueDate: "desc"}},
        projects: true
      }
    });

    return res.status(200).json({success: true, data: {profile: full}})
    }
    catch(err){
        next(err);
    }
}


export async function updateMyProfile(req: Request, res: Response, next: NextFunction)
{
    try{

        const parsed= updateProfileSchema.safeParse(req.body);

        if(!parsed.success)
        {
            return res.status(400).json({success: false, message: "Validation error",
                errors: parsed.error.flatten().fieldErrors
            })
        }
      
        const profile= await getOrCreateProfile(req.user!.userId);

        const updated= await prisma.candidateProfile.update({where: {id: profile.id}, data:parsed.data});

        return res.status(200).json({success: true, data: {profile: updated}});
    }
    catch(err)
    {
        next(err);
    }
}


export async function addExperience(req:Request, res:Response, next:NextFunction)
{
    try{
      
        const parsed= experienceSchema.safeParse(req.body);
        if(!parsed.success)
        {
            return res.status(400).json({succes: false, message: "Validation error", errors: parsed.error.flatten().fieldErrors});
        }

        const profile= await getOrCreateProfile(req.user!.userId);

        const experience= await prisma.experience.create({data: {...parsed.data, profileId: profile.id}});

        return res.status(201).json({success: true, data: {experience}})
    }
    catch(err)
    {
        next(err);
    }
}

export async function updateExperience(req:Request, res:Response, next:NextFunction)
{
    try{
       const parsed=experienceSchema.partial().safeParse(req.body);
       if(!parsed.success)
       {
        return res.status(400).json({success: false, message: "Validation error", errors: parsed.error.flatten().fieldErrors})
       }

       const id= req.params.id as string;

       const experience=await prisma.experience.findUnique({where: {id}, include: {profile: true}});

       if(!experience || experience.profile.userId !== req.user!.userId)
       {
        return res.status(404).json({success: false, message: "Experience entry not found"});
       }

       const updated= await prisma.experience.update({where: {id},data: parsed.data});

       return res.status(200).json({success: true, data: {experience: updated}})
    }
    catch(err){
      next(err);
    }
}

export async function deleteExperience(req: Request, res:Response, next:NextFunction)
{
    try{
      const id=req.params.id as string;

      const experience= await prisma.experience.findUnique({where: {id}, include: {profile: true}});

      if(!experience || experience.profile.userId !== req.user!.userId)
      {
        return res.status(404).json({success: false, message: "Experience entry not found"})
      }

      await prisma.experience.delete({where: {id}});

      return res.status(200).json({success: true, message: "Experince deleted"})
    }
    catch(err)
    {
        next(err);
    }
}

export async function addEducation(req:Request, res:Response, next:NextFunction)
{
    try{
       const parsed=educationSchema.safeParse(req.body);

       if(!parsed.success)
       {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
       }

       const profile=await getOrCreateProfile(req.user!.userId);

       const education = await prisma.education.create({ data: { ...parsed.data, profileId: profile.id } });
         
       return res.status(201).json({success: true, data: {education}});
    }
    catch(err){
      next(err);
    }
}

export async function updateEducation(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed=educationSchema.partial().safeParse(req.body);

      if(!parsed.success)
       {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
       }

      const id= req.params.id as string;

      const education= await prisma.education.findUnique({where: {id}, include: {profile: true}});

      if(!education || education.profile.userId !== req.user!.userId)
      {
        return res.status(404).json({success: false, message: "Education entry not found"})
      }

      const updated= await prisma.education.update({where :{id}, data: parsed.data});
      return res.status(200).json({success: true, data: {education: updated}});
    }
    catch(err)
    {
        next(err);
    }
}

export async function deleteEducation(req: Request, res: Response, next: NextFunction)
{
    try{
      const id= req.params.id as string;

      const education= await prisma.education.findUnique({where: {id}, include: {profile: true}});

      if(!education || education.profile.userId !== req.user!.userId)
      {
        return res.status(404).json({success: false, message: "Education entry not found"})
      }

      await prisma.education.delete({where: {id}});

      return res.status(200).json({success: true, message: "Education deleted"})

    }
    catch(err)
    {
        next(err);
    }
}


export async function addCertification(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed= certificationSchema.safeParse(req.body);

      if(!parsed.success)
       {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
       }

       const profile= await getOrCreateProfile(req.user!.userId);

       const certification= await prisma.certification.create({data:{...parsed.data, profileId: profile.id}})
       
       return res.status(201).json({success: true, data: {certification}});
    }
    catch(err)
    {
        next(err);
    }
}


export async function deleteCertification(req: Request, res: Response, next: NextFunction)
{
    try{
      const id= req.params.id as string;

      const certification= await prisma.certification.findUnique({where: {id}, include: {profile: true}});

      if(!certification || certification.profile.userId !== req.user!.userId)
      {
        return res.status(404).json({success: false, message: "Certification not found"})
      }

      await prisma.certification.delete({where: {id}});

      return res.status(200).json({success: true, message: "Certification deleted"})
    }
    catch(err)
    {
        next(err);
    }
}


export async function addProject(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed=projectSchema.safeParse(req.body);

      if(!parsed.success)
       {
        return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
       }

      const profile= await getOrCreateProfile(req.user!.userId);
      
      const project= await prisma.project.create({data: {...parsed.data, profileId: profile.id}});

      return res.status(201).json({success: true, data: {project}});
    }
    catch(err){
        next(err);
    }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction)
{
    try{
       const id=req.params.id as string;

       const project=await prisma.project.findUnique({where: {id}, include: {profile: true}});

       if(!project || project.profile.userId !== req.user!.userId)
       {
        return res.status(404).json({success:false, message: "Project not found"});
       }

       await prisma.project.delete({where: {id}});

       return res.status(200).json({success: true, message: "Project deleted"})
    }
    catch(err){
      next(err);
    }
}


export async function getProfileByUserId(req: Request, res: Response, next: NextFunction)
{
    try{
      const userId= req.params.userId as string;

      const profile= await prisma.candidateProfile.findUnique({where: {userId},
      include:{
        experiences: {orderBy: {startDate: "desc"}},
        educations: {orderBy: {startDate: "desc"}},
        certifications: {orderBy: {issueDate: "desc"}},
        projects: true
      }
    });

    if(!profile)
    {
        return res.status(404).json({success: false, message: "Profile not found"})
    }

    return res.status(200).json({success: true, data: {profile}})
    }
    catch(err)
    {
        next(err);
    }
}