import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { createComplaintSchema } from "../schemas/complaint.schema.js";

export async function createComplaint(req: Request, res: Response, next: NextFunction)
{
    try{
      const parsed = createComplaintSchema.safeParse(req.body);
      if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const complaint = await prisma.complaint.create({
        data: { ...parsed.data, reporterId: req.user!.userId },
        });

      return res.status(201).json({ success: true, data: { complaint } });  
    }
    catch(err)
    {
        next(err);
    }
}