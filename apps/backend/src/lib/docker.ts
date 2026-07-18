import Dockerode, { Container } from "dockerode";
import { WebSocket } from "ws";

const docker = new Dockerode({
    socketPath : "/var/run/docker.sock",
});

export type GeneratedFile = {
    path : string,
    content : string,
}

export async function startSandbox(projectId : string , files : GeneratedFile[]) {
    const container = await docker.createContainer({
        Image : "node:18-apline",
        name : `sandbox-${projectId}`,
        // TeleTypewrite ek terminal hai if false automatically 
        // band hojata hai if it is true container chalta rehta hai 
        // baad me bi
        Tty : true,
        WorkingDir : "/app",
        Cmd : ["sh"]
    })

    await container.start()

    for(const file of files) {
        const dir = file.path.includes("/")
        ? file.path.substring(0, file.path.lastIndexOf("/"))
        : null;

        if(dir) {
            const mkdirExec = await container.exec({
                Cmd : ["mkdir", "-p" , `/app/${dir}`],
                AttachStdout : true,
                AttachStderr: true,
            })
            await mkdirExec.start({hijack : true , stdin : false})
        }

        const tar = require("tar-stream")
        const pack = tar.pack()

        pack.entry({name : file.path} , file.content);
        pack.finalize();

        await container.putArchive(pack , {path :"/app"})
    }

    const info = await container.inspect()

    return info.Id;
}
export async function stopSandbox(containerId :string) {
 try {
       const container = docker.getContainer(containerId)
   
       await container.stop({ t : 10})
      console.log(`Container ${containerId} has successfully stop `)
   
       await container.remove({force : true})
     console.log(`container ${containerId} has remove successfully`)
 } catch (error :any) {
    if(error.statusCode === 404) return;
    throw error
 }
}

export async function execSandbox(containerId : string, command : any , ws : WebSocket) {
    const container = docker.getContainer(containerId)

    const exec = await container.exec({
        Cmd:  ["sh" , "-c" , command], // sh -c => run with the help of shell
        AttachStderr: true,
        AttachStdout : true,
        WorkingDir : "/app",
    })

    const stream = await exec.start({hijack : true , stdin : false});

    return new Promise((resolve , reject) => {
       let output = ""

       const stdout  = new (require("stream").PassThrough)();
       const stderr  = new (require("stream").PassThrough)();

       docker.modem.demuxStream(stream ,stdout , stderr);
       
        stdout.on("data", (chunk : Buffer) => {
            const text = chunk.toString()
            output += text;

            if(ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({type : "output" , content : text}))
            }
        })
        stderr.on("data" , (chunk : Buffer) => {
            const text = chunk.toString()
            output += text;

            if(ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({type : "error" , content : text}))
            }
        })

        stream.on("end" , () => resolve(output.trim()))

        stream.on("error", (err : Error) => reject(err))

   
    })

   
}

export default docker