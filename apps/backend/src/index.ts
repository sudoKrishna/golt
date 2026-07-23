import express from "express";
import authRouter from  "./auth/auth";
import projectRouter from "./routes/project";
import generateRouter from "./routes/generate";
import sandboxRouter from "./routes/sandbox"
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { setHeartbeat } from "./lib/redis";
import { execSandbox } from "./lib/docker";
import { prisma, withRetry } from "@repo/db";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(express.json())
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Error code:", err.code)
  console.error("Error meta:", err.meta)
  console.error("Error message:", err.message)
  res.status(500).json({ error: err.message, code: err.code, meta: err.meta })
})

app.use("/api", authRouter)
app.use("/api", projectRouter)
app.use("/api", generateRouter)
app.use("/api", sandboxRouter)

wss.on("connection", (ws, req) => {
    const url = new URL(req.url! , `http://localhost`);
    const projectId = url.searchParams.get("projectId")

    if(!projectId) {
        ws.close(1008, "project not found")
        return 
    }

    ws.on("message", async(message :string) => {
      const {commad}  = JSON.parse(message.toString())
      await setHeartbeat(projectId)

      const sandbox = await withRetry(() =>
        prisma.sandboxPod.findUnique({
          where : {projectId}
        })
      )

      if(!sandbox || !sandbox.containerId) {
        ws.send(JSON.stringify({type : "error", message : "sandbox is not running"}))
        return;
      }

      const output = await execSandbox(sandbox.containerId , commad, ws)
      ws.send(JSON.stringify({type : "error" , messsage : "something went wrong"}))
    })

    ws.on("close", () => {
       console.log(`Client disconnected projectId: ${projectId}`);
    })



})


httpServer.listen(4000, () => {
  console.log("backend running in localhost:4000")
})

export default app;