import { prisma } from "@repo/db";
import { emitToProject } from "./ws";
import { ensureSandbox, restartDevServer } from "./sandbox";
import { askLLM, assistantMessage, toolResultMessage, type ToolCall } from "./gemini";
import { TOOL_DEFINITIONS, executeTool } from "./tools";
import { execInContainer } from "./e2b";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { clarificationTool, proceedTool, CLARIFY_MARKER } from "./tools/clarification.tool";
import { Sandbox } from "e2b";

export type ClarificationQuestion = {
  id: string;
  question: string;
  type: "options" | "text";
  options?: string[];
};

export type AgentResponse =
  | { type: "clarification"; reasoning: string; question: ClarificationQuestion[] }
  | { type: "answer"; reasoning: string; toolCalls: ToolCall[] };

const MAX_ITERATIONS = 25;
const MAX_TOTAL_ITERATIONS = 40;

const READ_ONLY_TOOLS = new Set(["read_file"]);

const runningControllers = new Map<string, AbortController>();

export function isAgentRunning(projectId: string): boolean {
  return runningControllers.has(projectId);
}

export function cancelAgent(projectId: string): boolean {
  const controller = runningControllers.get(projectId);
  if (!controller) return false;
  controller.abort();
  return true;
}

function encodeClarification(reasoning: string, questions: ClarificationQuestion[]): string {
  return CLARIFY_MARKER + JSON.stringify({ reasoning, questions });
}

function decodeClarification(
  content: string
): { reasoning: string; questions: ClarificationQuestion[] } | null {
  if (!content.startsWith(CLARIFY_MARKER)) return null;
  try {
    return JSON.parse(content.slice(CLARIFY_MARKER.length));
  } catch {
    return null;
  }
}

function toLLMMessage(msg: { role: string; content: string }) {
  const clarification =
    msg.role === "assistant" ? decodeClarification(msg.content) : null;

  if (clarification) {
    return {
      role: "assistant",
      content: [
        `I asked a clarifying question: ${clarification.reasoning}`,
        ...clarification.questions.map((q) => `- ${q.question}`),
      ].join("\n"),
    };
  }

  return { role: msg.role, content: msg.content };
}

function isPackageJsonPath(filePath: string): boolean {
  return filePath === "package.json" || filePath.endsWith("/package.json");
}

async function execWithRetry(
  containerId: string,
  cmd: string,
  retries = 2,
  delayMs = 3000,
  timeoutMs = 5 * 60_000
) {
  let result = await execInContainer(containerId, cmd, timeoutMs);
  let attempt = 0;

  while (result.exitCode !== 0 && attempt < retries) {
    attempt++;
    console.log(
      `[retry] "${cmd}" failed (exit ${result.exitCode}), retrying (${attempt}/${retries})...`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    result = await execInContainer(containerId, cmd, timeoutMs);
  }

  return result;
}

async function refreshPreview(projectId: string, containerId: string) {
  const sandbox = await Sandbox.connect(containerId);
  const previewUrl = `https://${sandbox.getHost(5173)}`;
  await prisma.project.update({
    where: { id: projectId },
    data: { previewUrl },
  });
  emitToProject(projectId, "preview:reloaded", { previewUrl });
}

export async function runAgent(projectId: string, userMessage: string) {
  console.log(`[agent] runAgent called projectId=${projectId} messageLen=${userMessage.length}`);
  if (runningControllers.has(projectId)) {
    emitToProject(projectId, "agent:error", {
      error:
        "An agent run is already in progress for this project. Please wait for it to finish.",
    });
    return;
  }

  const controller = new AbortController();
  const { signal } = controller;
  runningControllers.set(projectId, controller);

  try {
    await prisma.message.create({
      data: { projectId, role: "user", content: userMessage },
    });

    emitToProject(projectId, "agent:thinking", {});

    const existingFile = await prisma.projectFile.findMany({
      where: { projectId },
    });

    const history = await prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    const lastAssistantMessage = [...history]
      .reverse()
      .find((m) => m.role === "assistant");
    const alreadyAskedClarification = lastAssistantMessage
      ? decodeClarification(lastAssistantMessage.content) !== null
      : false;

    const messages: any[] = [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "",
          existingFile.length
            ? `Existing files:\n${existingFile.map((f) => `  - ${f.path}`).join("\n")}`
            : "No files yet — this is a completely new project.",
          alreadyAskedClarification
            ? "\nYou already asked a clarifying question in your last turn and the user has now replied. Do NOT call ask_clarification again — proceed with their answers plus reasonable assumptions."
            : "",
        ].join("\n"),
      },
      ...history.map(toLLMMessage),
    ];

    if (!alreadyAskedClarification) {
      console.log(`[agent] projectId=${projectId} calling clarification gate`);
      const gate = await askLLM(messages, [clarificationTool, proceedTool], "required");
      const gateCall = gate.toolCalls[0];

      console.log(`[AGENT] clarification gate ->`, gateCall?.name ?? "(no call)");

      const gateArgs = gateCall?.args as
        | { reasoning?: string; questions?: ClarificationQuestion[] }
        | undefined;

      if (
        gateCall?.name === "ask_clarification" &&
        (gateArgs?.questions?.length ?? 0) > 0
      ) {
        const args = gateCall.args as {
          reasoning: string;
          questions: ClarificationQuestion[];
        };
        const questions = args.questions ?? [];

        emitToProject(projectId, "agent:clarification", {
          reasoning: args.reasoning,
          questions,
        });

        const encoded = encodeClarification(args.reasoning, questions);

        await prisma.message.create({
          data: { projectId, role: "assistant", content: encoded },
        });

        emitToProject(projectId, "agent:done", { summary: encoded });
        return;
      }
    }

    console.log(`[agent] projectId=${projectId} ensureSandbox starting`);
    const sandboxT0 = Date.now();
    const sandbox = await ensureSandbox(projectId);
    const containerId = sandbox.containerId ?? null;
    console.log(`[agent] projectId=${projectId} ensureSandbox done in ${Date.now() - sandboxT0}ms containerId=${containerId}`);

    let iteration = 0;
    let productiveIterations = 0;
    let finalSummary = "";
    let isDone = false;
    let wroteFiles = false;
    let wrotePackageJson = false;

    while (
      productiveIterations < MAX_ITERATIONS &&
      iteration < MAX_TOTAL_ITERATIONS &&
      !isDone
    ) {
      if (signal.aborted) {
        finalSummary = "(Cancelled by user)";
        emitToProject(projectId, "agent:cancelled", {});
        break;
      }

      iteration++;
      console.log(
        `iteration ${iteration} (productive ${productiveIterations}/${MAX_ITERATIONS})`
      );

      const iterT0 = Date.now();
      const { toolCalls, text } = await askLLM(messages, TOOL_DEFINITIONS);
      console.log(`[agent] projectId=${projectId} iteration ${iteration} askLLM in ${Date.now() - iterT0}ms toolCalls=${toolCalls.length}`);

      if (text) {
        emitToProject(projectId, "agent:token", { text });
      }

      if (toolCalls.length === 0) {
        finalSummary = text;
        break;
      }

      messages.push(assistantMessage(text, toolCalls));

      if (toolCalls.some((call) => !READ_ONLY_TOOLS.has(call.name))) {
        productiveIterations++;
      }

      for (const call of toolCalls) {
        if (signal.aborted) break;

        console.log(`[AGENT] calling tool: ${call.name}`);
        emitToProject(projectId, "agent:tool_call", {
          tool: call.name,
          args: call.args,
        });

        if (call.name === "done") {
          finalSummary = (call.args as { summary: string }).summary ?? "";
          isDone = true;
          messages.push(toolResultMessage(call.id, "acknowledge"));
          break;
        }

        if (call.name === "write_file") {
          wroteFiles = true;
          const filePath = (call.args as { path?: string }).path ?? "";
          if (isPackageJsonPath(filePath)) {
            wrotePackageJson = true;
          }
        }

        // If you add write_files later:
        if (call.name === "write_files") {
          wroteFiles = true;
          const files = (call.args as { files?: { path: string }[] }).files ?? [];
          if (files.some((f) => isPackageJsonPath(f.path))) {
            wrotePackageJson = true;
          }
        }

        const result = await executeTool(
          call.name,
          call.args,
          projectId,
          containerId
        );
        console.log(`[agent] ${call.name} result:`, result.slice(0, 120));

        emitToProject(projectId, "agent:tool_result", {
          tool: call.name,
          result: result.slice(0, 500),
        });

        messages.push(toolResultMessage(call.id, result));
      }
    }

    // Cancelled — save message and stop (no install / no second done)
    if (signal.aborted) {
      await prisma.message.create({
        data: {
          projectId,
          role: "assistant",
          content: "(Cancelled by user)",
        },
      });
      emitToProject(projectId, "agent:done", {
        summary: "(Cancelled by user)",
        cancelled: true,
      });
      return;
    }

    // Files written → install only if package.json changed, always refresh preview
    if (wroteFiles && containerId) {
      if (wrotePackageJson) {
        console.log("Installing dependencies...");
        emitToProject(projectId, "agent:installing", {});
        const install = await execWithRetry(containerId, "cd /app && bun install");
        console.log("Install Exit Code:", install.exitCode);
        console.log("Install stdout:\n", install.stdout);
        console.log("Install stderr:\n", install.stderr);
        await restartDevServer(containerId);
      }
      // HMR handles normal .tsx/.css edits; still push fresh previewUrl to UI
      await refreshPreview(projectId, containerId);
    }

    const hitCap = !isDone && !finalSummary;

    if (hitCap) {
      finalSummary =
        "(Agent reached the max iteration without finishing — the project may be left in an incomplete state.)";
      console.error(
        `[Agent] hit max iterations (productive ${productiveIterations}/${MAX_ITERATIONS}, total ${iteration}/${MAX_TOTAL_ITERATIONS})`
      );
      emitToProject(projectId, "agent:incomplete", {
        reason: "max_iterations",
        productiveIterations,
        totalIterations: iteration,
      });
    }

    await prisma.message.create({
      data: { projectId, role: "assistant", content: finalSummary },
    });

    console.log(hitCap ? "[agent] finished incomplete" : "[agent] complete");
    emitToProject(projectId, "agent:done", {
      summary: finalSummary,
      incomplete: hitCap,
    });
  } catch (error) {
    if (signal.aborted) {
      emitToProject(projectId, "agent:cancelled", {});
      emitToProject(projectId, "agent:done", {
        summary: "(Cancelled by user)",
        cancelled: true,
      });
    } else {
      console.error(`[agent] runAgent error projectId=${projectId}`, error);
      emitToProject(projectId, "agent:error", { error: String(error) });
    }
  } finally {
    runningControllers.delete(projectId);
  }
}