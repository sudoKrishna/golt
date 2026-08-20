"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMe,
  getProjects,
  getMessages,
  sendMessages,
  getFiles,
  startSandbox,
  isAuthError,
} from "@/app/lib/api"
import { useGithubStore, useProjectStore } from "@/store/project.store"
import ProjectTabs from "@/app/components/ProjectMenu";
import Chat from "@/app/components/Chat";
import { PushModal } from "@/app/components/GithubConnector";
import Link from "next/link";
import { CLARIFY_MARKER } from "@/app/components/Chat";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const {
    messages,
    setMessages,
    addMessage,
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    isAgentThinking,
    setIsAgentThinking,
    previewUrl,
    setPreviewUrl,
    previewNonce,
    reloadPreview,
    activeTab,
    setActiveTab,
    currentProject,
    setCurrentProject,
  } = useProjectStore();
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [input, setInput] = useState("");
  const [fetching, setFetching] = useState(true);
  const [showPushModal, setShowPushModal] = useState(false);

  const { connected: githubConnected, loadStatus: loadGithubStatus } =
    useGithubStore();

  useEffect(() => {
    loadGithubStatus();
  }, [loadGithubStatus]);

  useEffect(() => {
    async function init() {

      try {
        await getMe();

        const projects = await getProjects();
        const project = projects.find((p: any) => p.id === id);
        if (!project) { router.push("/dashboard"); return; }
        setCurrentProject(project);
        if (project.previewUrl) setPreviewUrl(project.previewUrl);
      } catch (err) {
        if (isAuthError(err)) router.push("/login");
        setFetching(false);
        return;
      }


      try {
        const msgData = await getMessages(id);
        setMessages(msgData.messages ?? []);
      } catch (err) {
        console.error("Failed to load messages", err);
      }

      try {
        const fileData = await getFiles(id);
        setFiles(fileData.files ?? []);
      } catch (err) {
        console.error("Failed to load files", err);
      }

      try {
        const sandbox = await startSandbox(id);
        if (sandbox?.previewUrl) setPreviewUrl(sandbox.previewUrl);
      } catch (err) {
        console.error("Failed to start sandbox", err);
      }

      setFetching(false);
    }
    init();
  }, [id]);

  

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");

    if (!token) return;

   const ws = new WebSocket(
  `${process.env.NEXT_PUBLIC_WS_URL}?token=${encodeURIComponent(token)}`
   );

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", projectId: id }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const eventName = msg.event;
        const data = msg.data ?? {};

        if (eventName === "agent:thinking") {
          setIsAgentThinking(true);

          const last = useProjectStore.getState().messages.at(-1);
          if (!(last?.role === "assistant" && last.content === "")) {
            addMessage({
              id: `ai-${Date.now()}`,
              role: "assistant",
              content: "",
              projectId: id
            })
          }
        }

        if (eventName === "agent:token") {
          useProjectStore.getState().appendToken(data.text ?? "")
        }

        if (eventName === "agent:clarification") {
          useProjectStore.getState().setLastAssistantContent(
            CLARIFY_MARKER + JSON.stringify({
              reasoning: data.reasoning ?? "",
              questions: data.questions ?? [],
            })
          );
          setIsAgentThinking(false);
        }

        if (eventName === "preview:reloaded") {
          useProjectStore.getState().reloadPreview();
        }

        if (eventName === "file:written") {
          const file = {
            path: data.path,
            content: data.content ?? ""
          }

          useProjectStore.getState().upsertFile(file);

          useProjectStore.getState().setSelectedFile(file);
        }

        if (eventName === "agent:done") {
          setIsAgentThinking(false);
          if (data.summary) {
            useProjectStore.getState().setLastAssistantContent(data.summary);
          }
          if (data.error) console.error("Agent error:", data.error);
        }
      } catch (error) {
        console.error("ws parse error", error)
      }
    }

    ws.onerror = (err) => {
      console.error("websocket error", err)
    }

    ws.onclose = () => {
      console.log("Websocket closed")
    }

    return () => {
      ws.close()
    }
  }, [id, addMessage, setIsAgentThinking])




  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    } catch (err) {
      console.error(err);
      setIsAgentThinking(false)
    } finally {
      setIsAgentThinking(false);
    }
  }

  if (fetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0d0d] text-white flex overflow-hidden">

      {/* chat*/}
      <Chat />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-neutral-800 flex items-center justify-start px-4 bg-[#0d0d0d]">
          <ProjectTabs
           activeTab={activeTab}
           setActiveTab={setActiveTab}
           />

          <div className="absolute right-4 flex items-center gap-3">
            {githubConnected ? (
              <button
                onClick={() => setShowPushModal(true)}
                className="text-xs text-neutral-500 hover:text-white"
              >
                Push to GitHub
              </button>
            ) : (
              <Link
                href="/settings/connectors"
                className="text-xs text-neutral-500 hover:text-white"
                title="Connect GitHub to push this project"
              >
                Connect GitHub to push
              </Link>
            )}

            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-500 hover:text-white"
              >
                Open ↗
              </a>
            )}
          </div>
        </div>

        {showPushModal && (
          <PushModal
            projectId={id}
            onClose={() => setShowPushModal(false)}
          />
        )}

        {activeTab === "preview" ? (
          previewUrl ? (
            <iframe
              key={previewNonce}
              src={previewUrl}
              className="flex-1 w-full border-none bg-white"
              title="Preview"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-500">
              Starting sandbox...
            </div>
          )
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-64 border-r border-neutral-800 bg-[#111111] overflow-y-auto">
              <div className="p-3 text-xs uppercase text-neutral-500">
                Files
              </div>

              {files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`block w-full text-left px-3 py-2 text-sm ${selectedFile?.path === file.path
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-900"
                    }`}
                >
                  {file.path}
                </button>
              ))}
            </div>

            <pre className="flex-1 overflow-auto p-6 text-sm font-mono bg-[#0d0d0d]">
              {selectedFile?.content || "Select a file"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}