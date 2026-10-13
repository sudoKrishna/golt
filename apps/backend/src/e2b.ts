import { Sandbox, waitForFile } from "e2b";
import path from "path";

const TEMPLATE = "sandbox-base";
const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000;


export const BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot'];

export function isBinaryPath(filePath: string) {
    return BINARY_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

async function getSandbox(sandboxId: string): Promise<Sandbox> {
    console.log(`[e2b] connecting to sandbox ${sandboxId}`);
    const t0 = Date.now();
    const sandbox = await Sandbox.connect(sandboxId);
    await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
    console.log(`[e2b] connected to sandbox ${sandboxId} in ${Date.now() - t0}ms`);
    return sandbox;
}

export async function createAndStart(projectId: string) {
    console.log(`[e2b] creating sandbox for project ${projectId}`);
    const t0 = Date.now();
    try {
        const sandbox = await Sandbox.create(TEMPLATE, {
            metadata: {
                projectId,
            },
            timeoutMs: SANDBOX_TIMEOUT_MS,
        });

        console.log(`[e2b] created sandbox ${sandbox.sandboxId} for project ${projectId} in ${Date.now() - t0}ms`);
        return sandbox.sandboxId;
    } catch (error) {
        console.error(`[e2b] Error creating sandbox after ${Date.now() - t0}ms:`, error);
        throw error;
    }
}

export async function stopContainer(containerId: string) {
    try {
        const sandbox = await getSandbox(containerId);
        await sandbox.kill();
    } catch (error) {
        console.error("Error stopping sandbox:", error);
    }
}

export async function runInBackground(
    containerId: string,
    command: string
): Promise<void> {
    console.log(`[e2b] runInBackground start: "${command}"`);
    const t0 = Date.now();
    const sandbox = await getSandbox(containerId);

    await sandbox.commands.run(command, { background: true });
    console.log(`[e2b] runInBackground launched in ${Date.now() - t0}ms: "${command}"`);
}

export type ExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};

export async function execInContainer(
    containerId: string,
    command: string,
    timeoutMs: number = 120_000
): Promise<ExecResult> {
    console.log(`[e2b] exec start: "${command}" (timeout ${timeoutMs}ms)`);
    const t0 = Date.now();
    const sandbox = await getSandbox(containerId);

    try {
        const result = await sandbox.commands.run(command, { timeoutMs });
        console.log(`[e2b] exec done in ${Date.now() - t0}ms: "${command}" exit=${result.exitCode}`);

        return {
            stdout: result.stdout.trim(),
            stderr: result.stderr.trim(),
            exitCode: result.exitCode ?? 0,
        };
    } catch (error) {
        console.error(`[e2b] exec FAILED after ${Date.now() - t0}ms: "${command}"`, error);
        throw error;
    }
}

export async function writeFiles(
    containerId: string,
    files: { path: string; content: string }[]
) {
    console.log(`[e2b] writeFiles start: ${files.length} file(s)`);
    const t0 = Date.now();
    const sandbox = await getSandbox(containerId);

    for (const file of files) {
        const dest = `/app/${file.path}`;
        if (isBinaryPath(file.path)) {
            const buf = Buffer.from(file.content, "base64");
            await sandbox.files.write(dest, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
        } else {
            await sandbox.files.write(dest, file.content);
        }
    }
    console.log(`[e2b] writeFiles done in ${Date.now() - t0}ms`);
}

export async function readFile(
    containerId: string,
    path: string
): Promise<string | null> {
    try {
        const sandbox = await getSandbox(containerId);
        const content = await sandbox.files.read(`/app/${path}`);

        return content || null;
    } catch {
        return null;
    }
}
