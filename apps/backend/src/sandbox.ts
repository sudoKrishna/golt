import { prisma } from "@repo/db";
import { createAndStart, execInContainer, runInBackground, stopContainer, writeFiles } from "./e2b";
import { Sandbox } from "e2b";

const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof createSandbox>>>>();

const DEV_COMMAND =
    "cd /app && bun run dev -- --host 0.0.0.0 --port 5173 > /tmp/vite.log 2>&1";

export async function restartDevServer(containerId: string) {
    try {

        await execInContainer(containerId, "pkill -f 'vi[t]e' || true");
        await runInBackground(containerId, DEV_COMMAND);
    } catch (error) {
        console.error("[sandbox] failed to restart dev server", error);
        throw error;
    }
}


async function isAlive(containerId: string | null) {
    if (!containerId) return false;
    try {
        await Sandbox.connect(containerId);
        return true;
    } catch {
        return false;
    }
}

async function isDevServerRunning(containerId: string) {
    try {
        const result = await execInContainer(
            containerId,
            "pgrep -f 'vi[t]e' > /dev/null && echo up || echo down"
        );
        return result.stdout.trim() === "up";
    } catch {
        return false;
    }
}

export function ensureSandbox(projectId : string) {
    const pending = inFlight.get(projectId);
    if (pending) return pending;

    const promise = createSandbox(projectId).finally(() => {
        inFlight.delete(projectId);
    });
    inFlight.set(projectId, promise);
    return promise;
}

async function createSandbox(projectId : string) {
    console.log("[1] ensureSandbox", projectId);
    const existing = await prisma.sandboxPod.findUnique({
        where : {projectId}

    })

     console.log("[2] existing", existing);


    if (existing?.status === "running" && (await isAlive(existing.containerId))) {
        if (!(await isDevServerRunning(existing.containerId!))) {
            console.log("[2b] dev server down, restarting", existing.containerId);
            await restartDevServer(existing.containerId!);
        }
        return existing;
    }

     await prisma.sandboxPod.upsert({
      where: { projectId },
      update: { status: 'creating' },
      create: { projectId, status: 'creating' }
   })

    try {
        console.log("[CREATING SANDBOX]", projectId);
        const containerId = await createAndStart(projectId);
        console.log("[3] containerId", containerId);


        const files =  await prisma.projectFile.findMany({
            where : {projectId}
        })
        console.log("[4] files", files.length);

        await writeFiles(containerId , files)
        console.log("[5] files written");

        await execInContainer(containerId, "cd /app && bun install");

        await runInBackground(containerId, DEV_COMMAND);
        console.log("[6] Vite started");

        const sandbox = await Sandbox.connect(containerId);
        const previewUrl = `https://${sandbox.getHost(5173)}`;
        console.log("[7] previewUrl", previewUrl);

        const pod = await prisma.sandboxPod.update({
            where : {projectId},
            data : {
                status : "running",
                containerId,
                lastHeartbeat : new Date()
            }

        })

        await prisma.project.update({
            where : {id :projectId},
            data : {previewUrl}
        })
        return pod;
    } catch (error) {
        await prisma.sandboxPod.update({
            where: { projectId },
            data: { status: "stopped" },
        }).catch(() => {});
        throw error;
    }
}

export async function stopSandbox(projectId :string) {
    const sandboxPod = await prisma.sandboxPod.findUnique({
        where : {projectId}
    })

    if(!sandboxPod || !sandboxPod.containerId) {
       return
    }

    await stopContainer(sandboxPod.containerId);

    await prisma.sandboxPod.update({
        where : {projectId},
        data : {status : 'stopped'}
    })
}

export async function heartbeat(projectId : string) {
    await prisma.sandboxPod.update({
        where : {projectId},
        data : {lastHeartbeat : new Date()}
    })
}
