"use client";
import { useProjectStore } from "@/store/project.store";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, ChevronDown, Paperclip, Sparkles } from "lucide-react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  }, [messages, isAgentThinking]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

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
    <div className="flex flex-col border-b md:border-r md:border-b-0 shrink-0 border-white/10 w-full md:w-[380px] h-1/2 md:h-full bg-[#0a0a0a]">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-white/10 shrink-0">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={15} />
        </button>
        <span className="text-sm font-medium truncate flex-1">
          {currentProject?.name ?? "Project"}
        </span>
        {isAgentThinking && (
          <span className="flex items-center gap-1.5 text-[11px] text-blue-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Working
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center mt-16 gap-2">
            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
              <Sparkles size={16} />
            </div>
            <p className="text-xs text-neutral-500 max-w-[220px]">
              Kuch batao — kya banana hai?
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageCard key={msg.id} msg={msg} />
        ))}

        {isAgentThinking && (
          <div className="flex items-center gap-1.5 mr-6 px-3.5 py-2.5 bg-[#151513] rounded-2xl rounded-bl-md border border-white/10 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3">
        <div className="border border-white/10 focus-within:border-white/25 rounded-2xl p-3 bg-[#141412] transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Ask Golt to build something..."
            className="w-full bg-transparent outline-none resize-none text-sm placeholder:text-neutral-500 max-h-40"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              title="Attach files"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Paperclip size={15} />
            </button>
            <button
              onClick={handleSend}
              disabled={isAgentThinking || !input.trim()}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition-colors"
              aria-label="Send message"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
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
      <div className="ml-8 px-3.5 py-2.5 rounded-2xl rounded-br-md bg-blue-600/15 border border-blue-500/20 text-neutral-100 text-sm leading-relaxed w-fit max-w-full break-words">
        {msg.content}
      </div>
    );
  }

  if (typeof msg.content === "string" && msg.content.startsWith(CLARIFY_MARKER)) {
    return <ClarificationCard raw={msg.content} />;
  }

  if (!msg.content) {
    return (
      <div className="mr-6 px-3.5 py-2.5 bg-[#151513] rounded-2xl rounded-bl-md border border-white/10 w-fit">
        <span className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" />
        </span>
      </div>
    );
  }

  return (
    <div className="mr-6 bg-[#151513] border border-white/10 rounded-2xl rounded-bl-md p-3.5">
      <div className="text-sm font-medium text-white leading-relaxed">
        {generateTopic(msg.content)}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 transition-colors"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${showDetails ? "rotate-180" : ""}`}
          />
          {showDetails ? "Hide details" : "Details"}
        </button>

        <button
          className="px-3 py-1.5 text-xs rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors"
          onClick={handlePreview}
        >
          Preview
        </button>
      </div>
      {showDetails && (
        <div className="mt-3 p-3 text-xs text-neutral-400 bg-black/40 border border-white/5 rounded-lg whitespace-pre-wrap max-h-64 overflow-y-auto">
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
    <div className="mr-6 bg-[#151513] border border-white/10 rounded-2xl rounded-bl-md p-3.5 space-y-3.5">
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 mt-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <span className="text-amber-400 text-[11px] font-bold">?</span>
        </div>
        <div className="text-sm font-medium text-white leading-relaxed">{reasoning}</div>
      </div>

      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <div className="text-xs text-neutral-400">{q.question}</div>

          {q.type === "options" && q.options?.length ? (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  disabled={submitted}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    answers[q.id] === opt
                      ? "bg-white text-black border-white font-medium"
                      : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"
                  } disabled:cursor-default`}
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
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-white/25 transition-colors"
            />
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitted || isAgentThinking}
        className="px-3.5 py-2 text-xs rounded-lg bg-white text-black font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white transition-colors"
      >
        {submitted ? "Answered" : "Submit answers"}
      </button>
    </div>
  );
}
