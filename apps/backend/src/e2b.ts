import { Sandbox, waitForFile } from "e2b";
import path from "path";

const TEMPLATE = "sandbox-base";
const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000;


export const BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot'];

export function isBinaryPath(filePath: string) {
    return BINARY_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

async function getSandbox(sandboxId: string): Promise<Sandbox> {
    const sandbox = await Sandbox.connect(sandboxId);
    await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
    return sandbox;
}

export async function createAndStart(projectId: string) {
    try {
        const sandbox = await Sandbox.create(TEMPLATE, {
            metadata: {
                projectId,
            },
            timeoutMs: SANDBOX_TIMEOUT_MS,
        });

        return sandbox.sandboxId;
    } catch (error) {
        console.error("Error creating sandbox:", error);
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
    const sandbox = await getSandbox(containerId);

    await sandbox.commands.run(command, { background: true });
}

export type ExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};

export async function execInContainer(
    containerId: string,
    command: string
): Promise<ExecResult> {
    const sandbox = await getSandbox(containerId);

    const result = await sandbox.commands.run(command);

    return {
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        exitCode: result.exitCode ?? 0,
    };
}

export async function writeFiles(
    containerId: string,
    files: { path: string; content: string }[]
) {
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
