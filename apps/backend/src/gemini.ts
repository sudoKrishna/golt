// import { GoogleGenAI , Type } from "@google/genai";

// const ai = new GoogleGenAI({apiKey : process.env.GEMINI_KEY})

// const SYSTEM_PROMPT = `You are an expert code generator.

// RULES:
// - Return ONLY the files that need to be created or modified
// - Do NOT return files that are unchanged
// - Do NOT add explanation, comments, or description outside of code
// - Write complete, working code in every file
// - Always wrap all files in <files> tag
// - Each file must be in <file path="..."> tag

// OUTPUT FORMAT (exactly):
// <files>
//   <file path="src/App.tsx">
//     // code here
//   </file>
// </files>`;

// export type GeneratedFile = {
//     path : string,
//     content : string
// }

// export async function generateCode(prompt : string , existringFiles : GeneratedFile[]) {
//     const existingFilesContext = existringFiles.length > 0 ? `EXISTING PROJECT FILES (only return the if modifying them):
//     ${existringFiles.map((f) => `path : ${f.path}\n${f.content}`).join(`\n\n--\n\n`)}`
//     : "NO existing file - fresh project"

//     const userMessage = `${existingFilesContext}
//     USER REQUEST : ${prompt}`;

//     const stream = await ai.models.generateContentStream({
//         model : "gemini-2.0-flash",
//         contents : userMessage,
//         config : {
//             systemInstruction : SYSTEM_PROMPT,
//             temperature : 0.2,
//             maxOutputTokens : 8192,
//         },
//     });
//     return stream;
// }
// export function parseFiles(fullResponse : string) : GeneratedFile[] {
//     const files : GeneratedFile[] = []

//     const filesBlockMatch = fullResponse.match(/<files>([\s\S]*?)<\/files>/);
//     if(!filesBlockMatch) {
//         throw new Error("Response mein <files> tag is not found . Response:\n" + fullResponse.slice(0, 300))
//     }
//       const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
//       let match;

//      while ((match = fileRegex.exec(filesBlockMatch[1]!)) !== null) {
//         files.push({
//       path: match[1]!.trim(),
//       content: match[2]!.replace(/^\n/, "").replace(/\n$/, ""),
//     });
//   }

//   if (files.length === 0) {
//     throw new Error("Koi file parse nahi hui");
//   }

//   return files;
// }

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>
}

export async function askLLM(
  messages: any[],
  tools: OpenAI.Chat.ChatCompletionTool[],
  toolChoice: OpenAI.Chat.ChatCompletionToolChoiceOption = "auto"
): Promise<{ toolCalls: ToolCall[]; text: string }> {
  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    stream: false,
    temperature: 0.2,
    max_tokens: 8192,
    tools,
    tool_choice: toolChoice,
    messages,
  })

  const message = response.choices[0]?.message;
  if (!message) throw new Error("DeepSeek return no response");

  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls: ToolCall[] = message.tool_calls
      .filter((tc) => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: parseArgs(tc.function.arguments),
      }));
    return { toolCalls, text: message.content ?? "" }
  }
  return { toolCalls: [], text: message.content ?? "" }
}


export function assistantMessage(text: string, toolCalls: ToolCall[]): any {
  return {
    role: "assistant",
    content: text ?? null,
    tool_calls: toolCalls.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: JSON.stringify(tc.args) }
    })),
  };
}

export function toolResultMessage(toolCallId: string, result: string): any {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: result,
  }
}


function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error("could not parse tool args", raw)
    return {}
  }
}