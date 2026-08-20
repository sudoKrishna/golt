import { prisma } from "@repo/db";
import { emitToProject } from "./ws";
import { writeFiles, readFile, execInContainer } from "./e2b";
import OpenAI from "openai";

export const TOOL_DEFINITIONS : OpenAI.Chat.ChatCompletionTool[] = [
      {
    type: "function",
    function: {
      name: "write_file",
      description: "Write or overwrite a file in the project.",
      parameters: {
        type: "object",
        properties: {
          path:    { type: "string", description: "Relative file path, e.g. src/index.ts" },
          content: { type: "string", description: "Full file content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the current content of a file in the project.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "done",
      description:
        "Signal that the task is complete. Always call this when finished.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Short summary of what was done, shown to the user.",
          },
        },
        required: ["summary"],
      },
    },
  },
]

export async function executeTool(toolName : string, args : Record<string, unknown>, projectId : string, containerId : string | null) : Promise<string> {
    
    if(toolName === "write_file") {
        const {path , content} = args as {path : string , content : string}

        if(path.includes("..") || path.startsWith("/")) {
            return `Error : unsafe path ${path}`
        }

        await prisma.projectFile.upsert({
            where : {projectId_path : {
                projectId ,path
            }},
            update : {content},
            create : {projectId , content , path}
        })
        if(containerId) {
        await writeFiles(containerId , [{path , content}])
        }

        emitToProject(projectId , "file:written" , {path, content})

       return `OK : wrote ${path}`
    }

    if(toolName === "read_file") {
        const {path } = args  as {path : string }

        const record = await prisma.projectFile.findUnique({
            where : {projectId_path : {projectId , path}}
        })

        if(record) return record.content;

        if(containerId) {
            const content = await readFile(containerId , path)
            if (content !== null) return content;
        }

        return `Error : file not found : ${path}`
    }

    if(toolName === "run_command") {
        const {command} = args as {command :string}

        if(!containerId) return "Error : no sandbox container is avaliable"
         
        emitToProject(projectId , "agent:command" , {command})

        const result = await execInContainer(containerId , command)
        const output = [result.stdout , result.stderr].filter(Boolean).join("\n")

         emitToProject(projectId, "agent:command_result", { command, output, exitCode: result.exitCode });

         return output
      ? `exit ${result.exitCode}\n${output}`
      : `exit ${result.exitCode} (no output)`;

    }

     if (toolName === "done") return "";
 
     return `Error: unknown tool "${toolName}"`;
}