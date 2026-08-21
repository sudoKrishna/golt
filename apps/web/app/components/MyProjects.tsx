"use client";

import { deleteProject, getProjects } from "@/app/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  updated_at?: string;
  image?: string;
};

function relativeTime(dateStr?: string) {
  if (!dateStr) return "recently";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "recently";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";

  const units: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];

  for (const [secs, label] of units) {
    const value = Math.floor(seconds / secs);
    if (value >= 1) return `${value} ${label}${value > 1 ? "s" : ""} ago`;
  }

  return "just now";
}

export default function MyProjects() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();
        setProjects(data ?? []);
      } catch (error) {
        console.error("Failed to load projects", error);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [projects, query]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this project? This can't be undone.")) return;

    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Failed to delete project", error);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="w-full min-h-[400px] bg-[#1b1b1b] rounded-3xl p-8 text-gray-400">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#1b1b1b] rounded-3xl p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-full p-1">
          <button className="px-4 py-1.5 rounded-full bg-neutral-700 text-white text-sm font-medium">
            My projects
          </button>
          <button
            disabled
            className="px-4 py-1.5 text-sm text-gray-500 cursor-not-allowed"
          >
            Community
          </button>
          <button
            disabled
            className="px-4 py-1.5 text-sm text-gray-500 cursor-not-allowed"
          >
            Learn
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500 shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="bg-transparent text-sm text-gray-200 placeholder:text-gray-500 outline-none w-40"
            />
          </div>

          <button className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            Last edited
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-700 py-24 text-center">
          <div className="text-4xl mb-3 text-neutral-600">◕</div>
          <p className="text-gray-300 font-medium">
            {query ? "No projects match your search" : "No projects yet"}
          </p>
          {!query && (
            <p className="text-sm text-gray-500 mt-1">
              Describe what you want to build above to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/project/${project.id}`)}
              className="cursor-pointer group"
            >
              <div
                className="
                  relative h-56 sm:h-64
                  rounded-2xl
                  overflow-hidden
                  border border-neutral-700
                  bg-neutral-900
                "
              >
                {project.image ? (
                  <img
                    src={project.image}
                    className="w-full h-full object-cover"
                    alt={project.name}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-5xl text-neutral-700">
                    ◕
                  </div>
                )}

                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  disabled={deletingId === project.id}
                  title="Delete project"
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white/80 backdrop-blur transition hover:bg-red-600/80 hover:text-white disabled:opacity-50"
                >
                  {deletingId === project.id ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path className="opacity-25" d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
                      <path className="opacity-75" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium bg-[#68483e]">
                  {project.name?.[0]?.toUpperCase() ?? "?"}
                </div>

                <div className="min-w-0">
                  <h3 className="text-white font-medium truncate">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Edited {relativeTime(project.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
