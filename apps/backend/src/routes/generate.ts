import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { prisma } from "@repo/db";

const router = Router();


router.post("/generate/:projectId",requireAuth,  async (req , res , next) => {
     const ownerId = (req as any).ownerId as string;
     const  projectId  = req.params.projectId as string;
     const {prompt} = req.body;

     const project = prisma.project.findFirst({
        where : {
            id : projectId,
            ownerId : ownerId
        },
     })

     if(!project) {
        return res.status(404).json({
            error : "Project was not found"
        })
     }
     const existingFiles = prisma.projectFile.findMany({
        where : {projectId},
        select : {path : true , content : true}
     })

     res.setHeader("Content-Type" , "text/event-stream");
     res.setHeader("Cache-Control" , "no-cache");
     res.setHeader("Connection", "keep-alive");


})