import { Router } from "express";
import { prisma, withRetry } from "@repo/db"

const router = Router()

// POST /projects — naya project banao DB mein
// GET /projects — logged in user ke saare projects
// GET /projects/:id — single project with files
// DELETE /projects/:id — project delete

router.post("/projects" , async (req , res, next) => {
    try {
        const ownerId = (req  as any).ownerId as string;
        const {name , sandboxId} = req.body;

         if(!name) {
            return res.status(400).json({
                error : "invalid project name"
            })
         }

         const project = await withRetry(() =>
            prisma.project.create({
                data : {
                    name, 
                    ownerId,
                    sandboxId
                }
            })
         )

         return res.status(201).json({project})
    } catch (error) {
        next(error)
    }
})

router.get("/projects" , async (req , res , next) => {
    const ownerId = (req as any) as string
    const {project} = req.body;

    const projects = await withRetry(() =>
        prisma.project.findMany({
            where : {ownerId},
            orderBy : {createAt : "desc"}
        })
    )

    return res.status(200).json({projects})
})

router.get("projects/:id" , async (req , res, next) => {
   try {
     const ownerId  = (req as any).ownerId as string
     const {id} = req.params;
 
     const project = await withRetry(() =>
        prisma.project.findFirst({
            where : {id ,ownerId},
            include : {
                projectFile : true,
                message : {
                    orderBy  : {createdAt : "asc"}
                }
            }
        })
     )
 
     if(!project) {
         return res.status(400).json({
             error : "project was not found"
         })
     }
 
     return res.status(200).json({
         project
     })
   } catch (error) {
    next(error)
   }
})

router.delete("projects/:id" , async (req , res, next) => {
   try {
     const ownerId = (req as any).ownerId as string
     const {id} = req.params;
 
     const project = await withRetry(() =>
        prisma.project.findFirst({
            where : {id, ownerId},
        })
     )

     if(!project) {
         return res.status(400).json({
             error : "project not found"
         })
     }
 
     await withRetry(() =>
        prisma.project.delete({
            where : {id}
        })
     )
 
     return res.status(200).json({message : "Project deleted"})
   } catch (error) {
    next(error)
   }
})

export default router;