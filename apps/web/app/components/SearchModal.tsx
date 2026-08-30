"use client";

import { getProjects } from "@/app/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  visibility?: string;
  owner?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function loadProjects() {
      setLoading(true);

      try {
        const data = await getProjects();

        setProjects(data ?? []);

        if (data?.length) {
          setSelected(data[0]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [open]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", close);

    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects;

    return projects.filter((project) =>
      project.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [projects, query]);

  useEffect(() => {
    if (!filteredProjects.length) {
      setSelected(null);
      return;
    }

    if (!selected || !filteredProjects.find((p) => p.id === selected.id)) {
      setSelected(filteredProjects[0]);
    }
  }, [filteredProjects]);

  if (!open) return null;

  return (
   <div
  onClick={onClose}
  className="fixed inset-0 z-50 flex justify-center items-start pt-6 px-3 sm:pt-20 sm:px-4"
>

      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[980px] h-[85vh] sm:h-[650px] bg-[#1c1c1c] rounded-3xl border border-neutral-700 overflow-hidden shadow-2xl flex flex-col sm:flex-row"
      >
        {/* LEFT */}

        <div className="w-full sm:w-[340px] max-h-[35vh] sm:max-h-none border-b sm:border-b-0 sm:border-r border-neutral-800 flex flex-col shrink-0">

          <div className="border-b border-neutral-800 p-5">

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-transparent outline-none text-white placeholder:text-neutral-500"
            />

          </div>

          <div className="flex-1 overflow-y-auto">

            <p className="px-5 pt-5 pb-2 text-xs uppercase text-neutral-500">
              Recent Projects
            </p>

            {loading && (
              <div className="px-5 text-neutral-400">
                Loading...
              </div>
            )}

            {!loading &&
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelected(project)}
                  className={`w-full sm:w-[327px] ml-0 sm:ml-2 px-3 py-2 text-left transition ${
                    selected?.id === project.id
                      ? "bg-blue-600 rounded-lg  text-white"
                      : "hover:bg-neutral-800 text-neutral-300"
                  }`}
                >
                  <div className="text-sm font-medium truncate">
                    {project.name}
                  </div>

                  <div className="mt-0.5 text-[11px] opacity-70">
                    {project.updated_at}
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* RIGHT */}

        <div className="flex-1 p-4 sm:p-8 text-white overflow-y-auto">

          {selected ? (
            <>
              <div className="h-40 sm:h-56 rounded-xl border border-neutral-700 bg-neutral-900" />

              <h2 className="mt-6 text-2xl sm:text-3xl font-semibold">
                {selected.name}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mt-8 text-neutral-400">

                <div>
                  <p>Owner</p>
                  <p className="text-white">
                    {selected.owner ?? "You"}
                  </p>
                </div>

                <div>
                  <p>Status</p>
                  <p className="text-white">
                    {selected.visibility ?? "Private"}
                  </p>
                </div>

                <div>
                  <p>Created</p>
                  <p className="text-white">
                    {selected.created_at ?? "-"}
                  </p>
                </div>

                <div>
                  <p>Last edited</p>
                  <p className="text-white">
                    {selected.updated_at ?? "-"}
                  </p>
                </div>

              </div>

              <button
                onClick={() => {
                  router.push(`/project/${selected.id}`);
                  onClose();
                }}
                className="mt-10 bg-neutral-800 hover:bg-neutral-700 px-6 py-3 rounded-lg"
              >
                Open Project
              </button>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500">
              No project found
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
