import { Router } from 'express';
import { prisma } from '@repo/db';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { requireAuth } from './middlewares/auth.middleware';
import { ensureSandbox } from './sandbox';
import { runAgent } from './agent';
import { isBinaryPath } from './e2b';

const router = Router();

const TEMPLATE_DIR = path.join(import.meta.dir, '../template');

const SKIP_FILES  = ['bun.lock' , 'package-lock.json', 'yarn.lock']

function getTemplateFiles() {
  const files: { path: string; content: string }[] = [];

  function walk(dir: string, base: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if(SKIP_FILES.includes(entry.name)) continue;
      if (['node_modules', '.git', 'dist', '.DS_Store'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const rel  = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
       } else {
        if (isBinaryPath(entry.name)) {
          files.push({ path: rel, content: readFileSync(full).toString('base64') });
        } else {
          files.push({ path: rel, content: readFileSync(full, 'utf-8') });
        }
    }
  }
}

  walk(TEMPLATE_DIR, '');
  return files;
}

router.post("/:id/start" , requireAuth ,async (req , res, next) => {
  console.log("START ROUTE HIT", req.params.id);
 try {
   const ownerId = (req as any).ownerId as string;

   const projectId = req.params.id! ;

   const project = await prisma.project.findUnique({
    where : {id : projectId}
   })

   if(!project || project.ownerId !== ownerId) {
    return res.status(400).json({
      error  : "project id required"
    })
   }

  const sandbox = await ensureSandbox(projectId);
 
  const updatedProject = await prisma.project.findUnique({
    where : {id  : projectId}
  })

 
   return res.status(200).json({
     sandbox,
     previewUrl : updatedProject?.previewUrl
   })
 } catch (error) {
  next(error)
 }

})

router.post("/" ,requireAuth , async (req , res, next) => {
 try {
   const ownerId = (req as any).ownerId  as string;
   const {prompt } = req.body;
 
   if(!prompt) {
     return res.status(400).json({error : "invalid projects name"})
   }
 
   const project  = await prisma.project.create({
     data : {
       name : prompt.slice(0, 60) , 
       ownerId,
     }
   })
   const templateFiles = getTemplateFiles();

   await prisma.projectFile.createMany({
    data : templateFiles.map((f) => ({
      projectId :project.id,
      path : f.path,
      content : f.content
    })),
    skipDuplicates : true
   })

   await ensureSandbox(project.id)

   runAgent(project.id , prompt)

   const updateProject = await prisma.project.findUnique({
    where : {id : project.id}
   })

   
   return res.status(201).json({project : updateProject})
 } catch (error) {
  next(error)
 }
})

router.get("/", requireAuth , async (req , res, next) => {
  try {
    const ownerId = (req as any).ownerId as string;
    
    const project  = await prisma.project.findMany({
      where : {ownerId},
      orderBy : {createAt : 'desc'}
    })
  
    return res.status(200).json({projects : project})
  } catch (error) {
    next(error)
  }

})

router.get("/:id" , requireAuth ,async (req , res, next) => {
  try {
    const ownerId = (req as any).ownerId as string;
  
    const project = await prisma.project.findUnique({
      where : {id : req.params.id}
    })
  
    if(!project || project.ownerId !== ownerId) {
      return res.status(404).json({error : "project not found"})
    }
  
    return res.status(200).json({project})
  } catch (error) {
    next(error)
  }
})

router.delete("/:id",  requireAuth , async (req , res, next) => {
try {
    const ownerId = (req as any).ownerId  as string;
    
    const project  = await prisma.project.findUnique({
      where : {id : req.params.id}
    })
  
    if(!project || project.ownerId !== ownerId) {
      return res.status(400).json({
        error : "project id not found"
      })
    }
  
    await prisma.project.delete({
      where : {id : req.params.id}
    })
  
    return res.status(200).json({message : "project deleted"})
} catch (error) {
  next(error)
}
})

export default router;
