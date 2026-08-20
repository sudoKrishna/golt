import OpenAI from "openai";


export const CLARIFY_MARKER = "__CLARIFY__";


export const proceedTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "proceed",
    description: `Call this when the user's request is clear enough to start building.
Prefer this over ask_clarification whenever reasonable assumptions would produce a good result.`,
    parameters: {
      type: "object",
      required: ["assumptions"],
      properties: {
        assumptions: {
          type: "string",
          description: "One sentence: what you are assuming about the request.",
        },
      },
    },
  },
};

export const clarificationTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "ask_clarification",
    description: `Call this tool when the user's request is too vague to act on well.
Use it ONLY when the answer would change significantly based on missing info.
DO NOT call it for greetings, simple questions, or anything self-explanatory.
Ask at most 3 focused questions. Prefer giving options over open-ended questions.`,
    parameters: {
      type: "object",
      required: ["reasoning", "questions"],
      properties: {
        reasoning: {
          type: "string",
          description: "One sentence: why you need clarification before proceeding.",
        },
        questions: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            required: ["id", "question", "type"],
            properties: {
              id: { type: "string" },
              question: { type: "string" },
              type: {
                type: "string",
                enum: ["options", "text"],
              },
              options: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};