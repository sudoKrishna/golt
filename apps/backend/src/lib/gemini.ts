import {GoogleGenAI , Type} from "@google/genai";


const ai = new GoogleGenAI({apiKey : process.env.GEMINI_KEY})

const SYSTEM_PROMPT = `you are a expert code generator.

RULES :
- Return ONLY the file that to be created and modifiled
- Do NOT return file that are unchanged
- Do NOT add explantion, comments or description outside of code
- Write complete, working code in every file`;

export type GeneratedFile = {
    path : string,
    content : string
}

export async function generateRespone(prompt : string , existingFiles :GeneratedFile[]) : Promise<GeneratedFile[]> {
   
    const existingFilesContext = existingFiles.length > 0 ? `EXISTING PROJECT FILES (only return these if modifying them):
    ${existingFiles.map((f) => `path : ${f.path}\n${f.content}`).join(`\n\n--\n\n`)}`
    : "NO existing file - fresh project"

    const userMessage = `${existingFilesContext}
    USER REQUEST : ${prompt}`;

    const response = await ai.models.generateContent({
        model : "gemini-3.5-flash",
        contents : userMessage,
        config : {
            systemInstruction : SYSTEM_PROMPT,
            temperature : 0.7,
            maxOutputTokens: 8192,
            responseMimeType : "application/json",
            responseSchema : {
                type : Type.ARRAY,
                items : {
                    type : Type.OBJECT,
                    properties : {
                        path : {
                            type:  Type.STRING,
                            description : "File path , e.g src/App.tsx",
                        },
                        content : {
                            type:  Type.STRING,
                            description : "Complete file content",
                        }
                    },
                    require : ["path" , "content"]
                }

            }
        }
    })
   const text = response.text;

   if(!text) {
    throw  new Error("Empty response for gemini")
   }

   const files : GeneratedFile[]= JSON.parse(text)
   
   return files
}

