"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Search,
  BookOpen,
  Plug,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import SearchModal from "./SearchModal";
import UserDropdownMenu from "./Dropdown";
import { getProjects } from "../lib/api";

type LinkItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type ActionItem = {
  action: "search";
  label: string;
  icon: ReactNode;
};

type NavItem = LinkItem | ActionItem;

type Project = {
  id: string;
  name: string;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={16} />,
  },
  {
    action: "search",
    label: "Search",
    icon: <Search size={16} />,
  },
  {
    href: "/resources",
    label: "Resources",
    icon: <BookOpen size={16} />,
  },
  {
    href: "/connectors",
    label: "Connectors",
    icon: <Plug size={16} />,
  },
];

type SidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();
        setProjects(data ?? []);
      } catch (error) {
        console.error("Failed to load projects", error);
      }
    }

    loadProjects();
  }, []);

  return (
    <>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <aside
        className={`
          relative flex flex-col h-screen shrink-0 bg-[#0a0a0a] border-r border-white/5
          transition-[width] duration-200 ease-in-out
          ${isOpen ? "w-56 sm:w-64" : "w-[60px]"}
        `}
      >
        <div className="flex items-center h-14 px-3 gap-2">
          <button
            onClick={onToggle}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors shrink-0"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          {isOpen && (
            <span className="flex items-center gap-1.5 font-semibold text-white text-sm">
              <Sparkles size={14} className="text-blue-400" />
              Golt
            </span>
          )}
        </div>

        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            if ("action" in item) {
              return (
                <button
                  key={item.label}
                  onClick={() => setSearchOpen(true)}
                  title={!isOpen ? item.label : undefined}
                  className="flex w-full items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <span className="shrink-0 w-5 flex items-center justify-center">
                    {item.icon}
                  </span>
                  {isOpen && (
                    <span className="flex-1 text-left truncate">{item.label}</span>
                  )}
                  {isOpen && (
                    <kbd className="text-[10px] text-neutral-600 font-mono border border-white/10 rounded px-1 py-0.5">
                      ⌘K
                    </kbd>
                  )}
                </button>
              );
            }
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                title={!isOpen ? item.label : undefined}
                className={`
                  flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <span className="shrink-0 w-5 flex items-center justify-center">
                  {item.icon}
                </span>
                {isOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}

          <div className="pt-2">
            <button
              onClick={() => {
                if (!isOpen) onToggle();
                setProjectsOpen((prev) => !prev);
              }}
              title={!isOpen ? "Projects" : undefined}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span className="shrink-0 w-5 flex items-center justify-center">
                <FolderOpen size={16} />
              </span>
              {isOpen && (
                <>
                  <span className="flex-1 text-left truncate">All Projects</span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-neutral-500 transition-transform duration-200 ${
                      projectsOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </>
              )}
            </button>

            {isOpen && projectsOpen && (
              <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                {projects.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-neutral-600">
                    No projects yet
                  </p>
                )}
                {projects.map((project) => {
                  const isActiveProject = pathname === `/project/${project.id}`;
                  return (
                    <button
                      key={project.id}
                      onClick={() => router.push(`/project/${project.id}`)}
                      className={`
                        flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left truncate transition-colors
                        ${
                          isActiveProject
                            ? "text-white bg-white/5 font-medium"
                            : "text-neutral-500 hover:text-white hover:bg-white/5"
                        }
                      `}
                    >
                      <ChevronRight size={12} className="shrink-0 text-neutral-600" />
                      <span className="truncate">{project.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="p-2 mt-auto">
          <UserDropdownMenu />
        </div>
      </aside>
    </>
  );
}
