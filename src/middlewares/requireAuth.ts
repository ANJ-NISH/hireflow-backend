import type {Request, Response, NextFunction} from "express";
import {verifyAccessToken, type JwtPayload} from "../utils/jwt.js";


declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {

    const authHeader= req.headers.authorization;

    if(!authHeader?.startsWith("Bearer ")){
        return res.status(401).json({success: false, message: "No Access Token Provided"});
    }

    const token= authHeader.split(" ")[1];

    try{
        req.user= verifyAccessToken(token);
        next();
    }
    catch(err){
        return res.status(401).json({success: false, message: "Invalid Access Token"});
    }
}

export function requireRole(...allowedRoles: JwtPayload["role"][]) {

    return (req: Request, res: Response, next: NextFunction) => {
        if(!req.user || !allowedRoles.includes(req.user.role)){
            return res.status(403).json({success: false, message: "You do not have permission to access this resource"});
        }
        next();
        }
}