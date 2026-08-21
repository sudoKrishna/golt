"use client";

import { GithubConnector } from "@/app/components/GithubConnector";
import MyProjects from "@/app/components/MyProjects";
import {
  createProject,
  deleteProject,
  sendMessages,
  getMe,
  getProjects,
  isAuthError,
} from "@/app/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

const SUGGESTIONS = [
  { label: "Landing page", prompt: "Build a landing page for my SaaS product" },
  { label: "Dashboard", prompt: "Build an analytics dashboard with charts" },
  { label: "Blog", prompt: "Build a personal blog with markdown posts" },
  { label: "Portfolio", prompt: "Build a portfolio website to showcase my work" },
  { label: "Mobile app UI", prompt: "Build a mobile app UI for a fitness tracker" },
];

export default function DashboardPage() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [visibility, setVisibility] = useState<"Public" | "Private">("Public");
  const [visibilityOpen, setVisibilityOpen] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const me = await getMe();
        setUser(me);
        await getProjects();
      } catch (err) {
        if (isAuthError(err)) router.push("/login");
      } finally {
        setFetching(false);
      }
    }

    init();
  }, [router]);

  async function handleBuild(overridePrompt?: string) {
    const value = (overridePrompt ?? prompt).trim();
    if (!value) return;

    setLoading(true);

    try {
      const { project } = await createProject(value);
      router.push(`/project/${project.id}`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0];

  return (
    <main className="relative min-h-screen rounded-3xl border border-zinc-800 w-full overflow-hidden bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 160% 110% at 50% 80%, #ff3d8a 0%, #ff3d8a 16%, #ec4899 28%, #a855f7 42%, #4f6bff 58%, #1a2560 74%, #05060f 88%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 110% 75% at 50% 95%, rgba(255,80,170,0.7), transparent 70%)",
        }}
      />

      <section className="relative z-10 flex min-h-screen flex-col items-center px-6 pt-40 pb-16">
        <h1 className="mb-3 text-center text-5xl font-semibold tracking-tight text-white md:text-6xl">
          Build something Goat
          {firstName ? <span className="text-neutral-400">{`, ${firstName}`}</span> : null}
        </h1>
        <p className="mb-10 text-center text-lg text-neutral-400">
          Create apps and websites by chatting with AI
        </p>

        <div className="w-full max-w-3xl">
          <div className="rounded-3xl bg-neutral-900/85 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur">
            <textarea
              rows={2}
              placeholder="Ask Lovable to create a prototype..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleBuild();
                }
              }}
              className="w-full resize-none bg-transparent px-2 pt-1 text-lg leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none"
            />

            <div className="mt-2 flex items-center justify-between px-1">
              <button
                type="button"
                title="Attach files"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVisibilityOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/10"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
                    </svg>
                    {visibility}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {visibilityOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-xl">
                      {(["Public", "Private"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setVisibility(opt);
                            setVisibilityOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-xs ${
                            opt === visibility
                              ? "bg-white/10 text-white"
                              : "text-neutral-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleBuild()}
                  disabled={loading || !prompt.trim()}
                  title="Build"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path className="opacity-25" d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
                      <path className="opacity-75" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => setPrompt(s.prompt)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <GithubConnector />
          </div>
        </div>

        <div className="mt-20 w-full min-w-0">
          <MyProjects />
        </div>
      </section>
    </main>
  );
}
