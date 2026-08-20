"use client";
import { useProjectStore } from "@/store/project.store";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react";
import { getMessages, sendMessages } from "../lib/api";

export const CLARIFY_MARKER = "__CLARIFY__";

type ClarificationQuestion = {
  id: string;
  question: string;
  type: "options" | "text";
  options?: string[];
};


export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    setMessages,
    addMessage,
    isAgentThinking,
    setIsAgentThinking,
    currentProject,
  } = useProjectStore();

  const [input, setInput] = useState("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || isAgentThinking) return;

    addMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content,
      projectId: id,
    });
    setInput("");
    setIsAgentThinking(true);

    try {
      await sendMessages(id, content)
    } catch (error) {
      console.log("Falied to send message", error)
      setIsAgentThinking(false);
    }
  }


  return (
    <div className="flex flex-col border-r shrink-0 border-gray-800 w-[360px]">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-gray-800 shrink-0">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ←
        </button>
        <span className="text-sm font-medium truncate">
          {currentProject?.name ?? "Project"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center mt-10">
            Kuch batao — kya banana hai?
          </p>
        )}

        {/* {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm px-3 py-2 leading-relaxed ${msg.role === "user"
                ? "bg-[#272725] text-[#A5A5A4] ml-6 rounded-full border border-[#41413E] rounded-br-none"
                : "bg-[#272725] text-[#A5A5A4] mr-6  rounded-2xl border border-[#41413E] rounded-bl-none"
              }`}
          >
            {msg.content}
          </div>
        ))} */}

        {messages.map((msg) => (
        <MessageCard key={msg.id} msg={msg} />
         ))}

        {isAgentThinking && (
          <div className="text-xs text-gray-500 animate-pulse mr-6 px-3 py-2 bg-gray-900 rounded-lg border border-gray-800">
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border border-neutral-700 rounded-2xl p-3 bg-neutral-900">
        <textarea
          rows={3}
          placeholder="Ask Lovable..."
          className="w-full bg-transparent outline-none resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex justify-between mt-3">
          <button>+</button>
          <button
            onClick={handleSend}
            disabled={isAgentThinking}
            className="w-8 h-8 rounded-full bg-white text-black disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageCard({ msg }: { msg: any }) {
  const [showDetails, setShowDetails] = useState(false);

  const { setActiveTab, reloadPreview } = useProjectStore();


  const handlePreview = () => {
    setActiveTab("preview");
    reloadPreview();
  }

  function generateTopic(text: string) {
    const words = text
      .replace(/[^\w\s]/gi, "")
      .split(" ")
      .slice(0, 5)
      .join(" ");

    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  if (msg.role === "user") {
    return (
      <div className="bg-[#272725] text-[#A5A5A4] ml-6 px-3 py-2 rounded-lg border border-[#41413E] rounded-br-none text-sm">
        {msg.content}
      </div>
    );
  }

  if (typeof msg.content === "string" && msg.content.startsWith(CLARIFY_MARKER)) {
    return <ClarificationCard raw={msg.content} />;
  }


  return (
    <div className="mr-6 bg-[#1f1f1d] border border-[#41413E] rounded-2xl p-3">

      <div className="text-sm font-medium text-white">
        {generateTopic(msg.content)}
      </div>
      <div className="flex gap-2 mt-3">

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="px-3 py-1 text-xs rounded-lg bg-neutral-800 text-gray-300 hover:bg-neutral-700"
        >
          {showDetails ? "Hide Details" : "Details"}
        </button>


        <button
          className="px-3 py-1 text-xs rounded-lg bg-[#484846] text-white border border-[#80807F] shadow-lg "
          onClick={handlePreview}
        >
          Preview
        </button>

      </div>
      {showDetails && (
        <div className="mt-3 p-3 text-xs text-gray-400 bg-black
         rounded-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      )}

    </div>
  );
}

function ClarificationCard({ raw }: { raw: string }) {
  const { id } = useParams<{ id: string }>();
  const { addMessage, isAgentThinking, setIsAgentThinking } = useProjectStore();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  let payload: { reasoning: string; questions: ClarificationQuestion[] } | null = null;
  try {
    payload = JSON.parse(raw.slice(CLARIFY_MARKER.length));
  } catch {
    payload = null;
  }

  if (!payload) return null;
  const { reasoning, questions } = payload;

  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  async function handleSubmit() {
    if (!allAnswered || submitted || isAgentThinking) return;

    const content = [
      "Answers to your clarifying questions:",
      ...questions.map((q) => `- ${q.question}: ${answers[q.id]}`),
    ].join("\n");

    setSubmitted(true);
    addMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content,
      projectId: id,
    });
    setIsAgentThinking(true);

    try {
      await sendMessages(id, content);
    } catch (error) {
      console.error("Failed to send clarification answers", error);
      setIsAgentThinking(false);
    }
  }

  return (
    <div className="mr-6 bg-[#1f1f1d] border border-[#41413E] rounded-2xl p-3 space-y-3">
      <div className="text-sm font-medium text-white">{reasoning}</div>

      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <div className="text-xs text-gray-400">{q.question}</div>

          {q.type === "options" && q.options?.length ? (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  disabled={submitted}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  className={`px-3 py-1 text-xs rounded-lg border ${
                    answers[q.id] === opt
                      ? "bg-white text-black border-white"
                      : "bg-neutral-800 text-gray-300 border-[#41413E] hover:bg-neutral-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              disabled={submitted}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder="Type your answer..."
              className="w-full bg-neutral-900 border border-[#41413E] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-neutral-500"
            />
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitted || isAgentThinking}
        className="px-3 py-1.5 text-xs rounded-lg bg-white text-black disabled:opacity-40"
      >
        {submitted ? "Answered" : "Submit"}
      </button>
    </div>
  );
}