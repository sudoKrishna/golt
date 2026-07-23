import { prisma } from "@repo/db";
import { execSandbox } from "./docker";

type ToolContext  = {
    projectId : string,
    containerId : string,
    ws? : WebSocket
}

export const tools = [
    {
        name : "read_file",
        description : "Read file from the project . use this when you need to see the current content of any file before makeing changes.",
        parameter : {
            type : "object",
            properties : {
                path : {
                    type : "string",
                    description : "File path to read e.g. src/App.tsx"
                },
            },
            required : ["path"]
        }
    },
    {
        name : "write_file",
        description : "Write and update a file in the project . Use this to create new files and modify existing ones.",
        parameter : {
            type : "object",
            properties : {
                path : {
                   type : "string",
                   description : "File path to write - e.g. src/App.tsx",
                },
                content : {
                type : "string",
                description : "Complete file content to write",
               },
            },
            required : ["path", "content"]
        },
       
    },
    {
      name : "list_files",
      description : "List all the files in project. Use this to understand the project structure before reading or writeing files.",
      parameter : {
        type : "object",
        properties : {},
        required : [],
      },
    },
    {
        name : "run_command",
        description : "Run  a terminal command inside the sandbox container - e.g. npm install , npm run dev ,node index.js . Use this to install the dependencies or run the project.",
        parameter : {
            type : "object",
            properties : {
                command : {
                    type : "string",
                    description : "Command to run - e.g. npm install"
                },
            },
            required : ["command"]
        }
    }
]

export async function  executeTool(
    toolName : string,
    params : Record<string , string>, 
    context  : ToolContext
    ):Promise<string> {
    const {projectId, containerId } = context;

    switch (toolName) {
        case "read_file" : {
            const file = await prisma.projectFile.findFirst({
               where : {
                projectId,
                path : params.path,
               },
            })

            if(!file) {
                return `Error : File "${params.path}" nahi mili project mein`
            }

            return file.content;
        }
        case "write_file" : {
            const path = params.path;
            const content = params.content;

            if(!path || !content) {
                return "Error : path aur content dono required hai"
            }
            await prisma.projectFile.upsert({
                where : {
                    projectId_path : {
                        projectId,
                        path 
                    },
                },
                update : {
                    content : params.content,
                },
                create : {
                    projectId,
                    path, 
                    content 
                },
            });
            return `File "${params.path}" successfully save ho gayi`;
        }

        case "list_files" : {
            const files = await prisma.projectFile.findMany({
                where : {projectId},
                select : {path : true}
            })

            if(files.length === 0) {
               return "Project does not have any file"
            }
            return files.map((f) => f.path).join("\n")
        }

        case "run_command" : {
            if(!containerId) {
                return "Error : sandbox was not running"
            }

            const output = await execSandbox(containerId , params.command,);

            return typeof output === "string" && output.trim()
           ? output.trim()
           : "Command chal gayi — koi output nahi aaya";
        }

        default : {
            return `Error : "${toolName}"  does not exists`
        }
    }
}