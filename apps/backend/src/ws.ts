import { WebSocketServer, WebSocket } from "ws";
import { verifyToken } from "./auth";
import { prisma } from "@repo/db";

let wss : WebSocketServer;

export async function attachWs(server : any) {
    wss =  new WebSocketServer({server})

    wss.on("error", (error) => {
        console.error("[ws] server error", error);
    });

    wss.on("connection" , async (ws : any , req) => {
        const url = new URL(req.url!, `http://localhost`);
        const token =  url.searchParams.get("token");

        const payload = token ? await verifyToken(token) : null;
        
        if(!payload) {
            ws.close(1008, "unauthorized" )
            return;
        }
        ws.userId = payload.ownerId;

        ws.on('message'  , async (raw : any) => {
            try {
                const {type , projectId} = JSON.parse(raw.toString())

                if(type === "join") {
                 const project = await prisma.project.findUnique({
                        where:  {id : projectId}
                    })

                if(!project || project.ownerId !== ws.userId) {
                   ws.send(JSON.stringify({type : 'error' , message:"Unauthorized"}))
                   return;
                }
                ws.projectId = projectId;
                }


            } catch (error) {
                ws.send(JSON.stringify({error : "invalid message"}))
            }
        });

        ws.on('error', (error: any) => {
            console.error("[ws] socket error", error);
        });

        ws.on('close', () => {});
    })

    
}


export function emitToProject(projectId : string , event : string , data : any) {
    
    wss.clients.forEach((client: any) => {
        if(client.projectId === projectId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({event, data}))
        }
    })
}



