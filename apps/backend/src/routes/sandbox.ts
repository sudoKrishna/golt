import { prisma, withRetry } from "@repo/db";
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { startSandbox, stopSandbox } from "../lib/docker";
import { setHeartbeat } from "../lib/redis";

const router = Router();

router.post("/sandbox/start/:projectId" ,requireAuth,  async (req , res, next) => {
try {
     const ownerId = (req as any).ownerId as string;
     const projectId = req.params.projectId as string;
    
     const project = await withRetry(() =>
        prisma.project.findFirst({
            where : {
                id : projectId, ownerId : ownerId
            },
        })
     );

     if(!project) {
        return res.status(400).json({
            error : "project is not found "
        })
     }
    
     const files = await withRetry(() =>
        prisma.projectFile.findMany({
            where : { projectId },
            select : {path : true, content : true}
        })
     )
    
     if(files.length === 0) {
        return res.status(400).json({error : "project dont not have any file generate it"})
     }
    
     const containerId = await startSandbox(projectId, files)
    
     await withRetry(() =>
        prisma.sandboxPod.upsert({
            where : {projectId},
            update  :{containerId , status : "running"},
            create : {
                projectId, containerId,status : "running"
            },
        })
     );
    
     await setHeartbeat(projectId);
    
     return res.status(200).json({
        containerId,
        previewUrl : project.previewUrl,
     })
} catch (error) {
    next(error)
}
})

router.post("/sandbox/stop/:projectId",requireAuth, async (req , res , next) => {
   try {
    const ownerId = (req as any).ownerId as string;
    const projectId = req.params.projectId as string;
 
     const project = await withRetry(() =>
        prisma.project.findFirst({
            where : {id : projectId }
        })
     )
 
     if(!project) {
        return res.status(400).json(
            "project was not found"
        )
     }
 
     const sandboxPod = await withRetry(() =>
        prisma.sandboxPod.findUnique({
            where : {projectId}
        })
     )
 
     if(!sandboxPod || !sandboxPod.containerId) {
         return res.status(400).json({
             error : "snadbox was not running"
         })
     }
 
     await stopSandbox(sandboxPod.containerId)
 
     await withRetry(() =>
        prisma.sandboxPod.delete({
            where : {projectId}
        })
     )
 
     await withRetry(() =>
        prisma.project.update({
            where : {id : projectId},
            data : {sanboxStatus : "stopped"}
        })
     )
 
     return res.status(200).json({message : "sandbox was stop"})
 
   } catch (error) {
    next(error)
   }
})

router.post("/sandbox/heartbeat/:projectId" , requireAuth , async (req , res, next) => {
   try {
     const projectId = req.params.projectId as string;
 
     await setHeartbeat(projectId)
 
     return res.status(200).json({ "ok" : true})
   } catch (error) {
    next(error)
   }
})
export default router;