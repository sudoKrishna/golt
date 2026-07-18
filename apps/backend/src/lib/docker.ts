import Dockerode from "dockerode";


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


export default docker