import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { prisma, withRetry } from "@repo/db";
import { generateCode, parseFiles } from "../lib/gemini";

const router = Router();
// sse is the rule that send data to the browser
// res.write is because res.json and res.send closed the connection 
// but there connection have to open so we use write
function sendSSE(res : any , data : object) {
    res.write(`data : ${JSON.stringify(data)}\n\n`)
}

router.post("/generate/:projectId",requireAuth,  async (req , res , next) => {
     const ownerId = (req as any).ownerId as string;
     const  projectId  = req.params.projectId as string;
     const {prompt} = req.body;

     const project = await withRetry(() =>
        prisma.project.findFirst({
            where : {
                id : projectId,
                ownerId : ownerId
            },
        })
     )

     if(!project) {
        return res.status(404).json({
            error : "Project was not found"
        })
     }

     const existingFiles = await withRetry(() =>
        prisma.projectFile.findMany({
            where : {projectId},
            select : {path : true , content : true}
        })
     )

     res.setHeader("Content-Type" , "text/event-stream");
     res.setHeader("Cache-Control" , "no-cache");
     res.setHeader("Connection", "keep-alive");
     res.flushHeaders();

     let fullResponse = "";

     const stream = await generateCode(prompt , existingFiles);

     for await (const chunk of stream) {
        const chunkText = chunk.text;

        if(chunkText) {
            fullResponse += chunkText;
        }

        sendSSE(res, {
            type : "chunk",
            content : chunkText,
        })
     }

     const files = parseFiles(fullResponse);
     
     await Promise.all(
        files.map((file) => 
            withRetry(() =>
                prisma.projectFile.upsert({
                    where : {
                        projectId_path : {
                            projectId,
                            path : file.path,
                        },
                    },
                    update : {
                        content : file.content,
                    },
                    create : {
                        projectId ,
                        path : file.path,
                        content : file.content
                    }
                })
            )
        )
     )

     sendSSE(res ,  {
        type : "done",
        files,
     })

     res.end();

})
export default router;