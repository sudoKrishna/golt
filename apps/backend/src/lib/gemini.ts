import {GoogleGenAI , Type} from "@google/genai";


const ai = new GoogleGenAI({apiKey : process.env.GEMINI_KEY})

const SYSTEM_PROMPT = `You are an expert code generator.

RULES:
- Return ONLY the files that need to be created or modified
- Do NOT return files that are unchanged
- Do NOT add explanation, comments, or description outside of code
- Write complete, working code in every file
- Always wrap all files in <files> tag
- Each file must be in <file path="..."> tag

OUTPUT FORMAT (exactly):
<files>
  <file path="src/App.tsx">
    // code here
  </file>
</files>`;

export type GeneratedFile = {
    path : string,
    content : string
}

export async function generateCode(prompt : string , existingFiles :GeneratedFile[])  {
   
    const existingFilesContext = existingFiles.length > 0 ? `EXISTING PROJECT FILES (only return these if modifying them):
    ${existingFiles.map((f) => `path : ${f.path}\n${f.content}`).join(`\n\n--\n\n`)}`
    : "NO existing file - fresh project"

    const userMessage = `${existingFilesContext}
    USER REQUEST : ${prompt}`;

    const stream = await ai.models.generateContentStream({
        model : "gemini-2.0-flash",
        contents  : userMessage,
        config : {
            systemInstruction : SYSTEM_PROMPT,
            temperature : 0.2,
            maxOutputTokens : 8192,
        },
    });
    return stream;
}

export function parseFiles(fullResponse : string) : GeneratedFile[] {
    const files : GeneratedFile[] = []

    const filesBlockMatch = fullResponse.match(/<files>([\s\S]*?)<\/files>/);
    if(!filesBlockMatch) {
        throw new Error("Response mein <files> tag is not found . Response:\n" + fullResponse.slice(0, 300))
    }
      const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
      let match;

     while ((match = fileRegex.exec(filesBlockMatch[1]!)) !== null) {
        files.push({
      path: match[1]!.trim(),
      content: match[2]!.replace(/^\n/, "").replace(/\n$/, ""),
    });
  }

  if (files.length === 0) {
    throw new Error("Koi file parse nahi hui");
  }

  return files;
}

