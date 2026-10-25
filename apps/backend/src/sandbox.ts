import { prisma } from "@repo/db";
import {
    createAndStart,
    ensureBunInstalled,
    ensureNodeUpgraded,
    execInContainer,
    runInBackground,
    stopContainer,
    writeFiles,
} from "./e2b";
import { Sandbox } from "e2b";
import { emitToProject } from "./ws";
import { acquireLock } from "./redis/lock";

const SANDBOX_LOCK_PREFIX = "lock:sandbox:";
const SANDBOX_TTL_MS = 10 * 60 * 1000;

const DEV_COMMAND =
    "cd /app && bun run dev -- --host 0.0.0.0 --port 5173 > /tmp/vite.log 2>&1";

async function waitForVite(containerId: string, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await execInContainer(
            containerId,
            "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/ || echo down"
        );
        const code = result.stdout.trim();
        if (code === "200" || code === "304") return true;
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

export async function restartDevServer(containerId: string) {
    try {
        await ensureNodeUpgraded(containerId);
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


async function waitForSandbox(projectId: string, maxWaitMs = 90_000) {
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
        const pod = await prisma.sandboxPod.findUnique({
            where: { projectId },
        });

        if (
            pod?.status === "running" &&
            pod.containerId &&
            (await isAlive(pod.containerId))
        ) {

            if (!(await isDevServerRunning(pod.containerId))) {
                console.log(
                    "[sandbox] waitForSandbox: dev server down, restarting",
                    pod.containerId
                );
                await restartDevServer(pod.containerId);
            }
            return pod;
        }

        if (pod?.status === "stopped" || pod?.status === "error") {
            throw new Error(`Sandbox creation failed for project ${projectId}`);
        }

        await new Promise((r) => setTimeout(r, 800));
    }

    throw new Error(`Timed out waiting for sandbox ${projectId}`);
}

export async function ensureSandbox(projectId: string) {

    const existing = await prisma.sandboxPod.findUnique({
        where: { projectId },
    });

    if (
        existing?.status === "running" &&
        existing.containerId &&
        (await isAlive(existing.containerId))
    ) {
        if (!(await isDevServerRunning(existing.containerId))) {
            console.log(
                "[sandbox] ensureSandbox: dev server down, restarting",
                existing.containerId
            );
            await restartDevServer(existing.containerId);
        }
        return existing;
    }

    const lockKey = `${SANDBOX_LOCK_PREFIX}${projectId}`;
    const release = await acquireLock(lockKey, SANDBOX_TTL_MS);


    if (!release) {
        console.log(
            `[sandbox] ensureSandbox: lock held by another instance, waiting… projectId=${projectId}`
        );
        return waitForSandbox(projectId);
    }

    try {

        const again = await prisma.sandboxPod.findUnique({
            where: { projectId },
        });

        if (
            again?.status === "running" &&
            again.containerId &&
            (await isAlive(again.containerId))
        ) {
            if (!(await isDevServerRunning(again.containerId))) {
                await restartDevServer(again.containerId);
            }
            return again;
        }

        return await createSandbox(projectId);
    } finally {
        await release();
    }
}

async function createSandbox(projectId: string) {
    console.log("[1] createSandbox", projectId);

    const existing = await prisma.sandboxPod.findUnique({
        where: { projectId },
    });
    console.log("[2] existing", existing);

    if (
        existing?.status === "running" &&
        existing.containerId &&
        (await isAlive(existing.containerId))
    ) {
        if (!(await isDevServerRunning(existing.containerId))) {
            console.log(
                "[2b] dev server down, restarting",
                existing.containerId
            );
            await restartDevServer(existing.containerId);
        }
        return existing;
    }

    await prisma.sandboxPod.upsert({
        where: { projectId },
        update: { status: "creating" },
        create: { projectId, status: "creating" },
    });

    try {
        console.log("[CREATING SANDBOX]", projectId);
        const containerId = await createAndStart(projectId);
        console.log("[3] containerId", containerId);

        await ensureBunInstalled(containerId);
        console.log("[3b] bun ready");

        await ensureNodeUpgraded(containerId);
        console.log("[3c] node ready");

        const files = await prisma.projectFile.findMany({
            where: { projectId },
        });
        console.log("[4] files", files.length);

        await writeFiles(containerId, files);
        console.log("[5] files written");

        emitToProject(projectId, "agent:installing", {});
        await execInContainer(containerId, "cd /app && bun install", 5 * 60_000);

        await runInBackground(containerId, DEV_COMMAND);
        console.log("[6] Vite started");

        const viteUp = await waitForVite(containerId);
        if (!viteUp) {
            const log = await execInContainer(
                containerId,
                "cat /tmp/vite.log || echo 'no log file'"
            );
            console.error(
                "[sandbox] Vite did not come up in time. /tmp/vite.log contents:\n",
                log.stdout,
                log.stderr
            );
        }

        const sandbox = await Sandbox.connect(containerId);
        const previewUrl = `https://${sandbox.getHost(5173)}`;
        console.log("[7] previewUrl", previewUrl);

        const pod = await prisma.sandboxPod.update({
            where: { projectId },
            data: {
                status: "running",
                containerId,
                lastHeartbeat: new Date(),
            },
        });

        await prisma.project.update({
            where: { id: projectId },
            data: { previewUrl },
        });

        return pod;
    } catch (error) {
        await prisma.sandboxPod
            .update({
                where: { projectId },
                data: { status: "stopped" },
            })
            .catch(() => { });
        throw error;
    }
}

export async function stopSandbox(projectId: string) {
    const sandboxPod = await prisma.sandboxPod.findUnique({
        where: { projectId },
    });

    if (!sandboxPod || !sandboxPod.containerId) {
        return;
    }

    await stopContainer(sandboxPod.containerId);

    await prisma.sandboxPod.update({
        where: { projectId },
        data: { status: "stopped" },
    });
}

export async function heartbeat(projectId: string) {
    await prisma.sandboxPod.update({
        where: { projectId },
        data: { lastHeartbeat: new Date() },
    });
}