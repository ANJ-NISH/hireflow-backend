import type {Request, Response, NextFunction} from "express";
import {prisma} from "../lib/prisma.js";
import {createCompanySchema, updateCompanySchema} from "../schemas/company.schema.js";
import { invalidateJobCaches } from "../services/jobCache.service.js";

export async function createCompany(req: Request, res: Response, next: NextFunction) {

    try{
        const parsed= createCompanySchema.safeParse(req.body);

        if(!parsed.success){
            return res.status(400).json({success: false, message: "Validation error", errors:
                parsed.error.flatten().fieldErrors
            })
        }

        const recruiterId= req.user!.userId;
        const existing= await prisma.company.findUnique({where: {recruiterId}});

        if(existing){
            return res.status(409).json({success: false, message: "You already have a company profile"});
        }

        const company= await prisma.company.create({
            data:{...parsed.data, recruiterId}
        });

        return res.status(201).json({success: true, data: {company}})
    }
    catch(err){
        next(err);
    }
}

export async function getMyCompany(req: Request, res: Response, next: NextFunction) {

    try{
      
        const company= await prisma.company.findUnique({where: {recruiterId: req.user!.userId}});

        if(!company){
            return res.status(404).json({success: false, message: "Company profile not found"});
        }

        return res.status(200).json({success: true, data: {company}})
    }
    catch(err){
        next(err);
    }
}

export async function updateMyCompany(req: Request, res: Response, next: NextFunction) {

    try{

        const parsed= updateCompanySchema.safeParse(req.body);

        if(!parsed.success){
            return res.status(400).json({success: false, message: "Validation error", errors:
                parsed.error.flatten().fieldErrors
            })
        }

        const company= await prisma.company.findUnique({where: {recruiterId: req.user!.userId}});

        if(!company){
            return res.status(404).json({success: false, message: "Company profile not found"});
        }

        const updated= await prisma.company.update({where: {id: company.id}, data: parsed.data});
        await invalidateJobCaches();

        return res.status(200).json({success: true, data: {company: updated}})
    }
    catch(err){
        next(err);
    }
}