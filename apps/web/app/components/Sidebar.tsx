"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import SearchModal from "./SearchModal";
import UserDropdownMenu from "./Dropdown";
import { getProjects } from "../lib/api";
import { useRouter } from "next/navigation";



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
  id : string;
  name : string;
};

const navItems: NavItem[] = [
 {
  href: "/dashboard",
  label: "Dashboard",
  icon: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-5"
    >
      <path
        d="M18.2499 8.93869L13.3173 5.37717C12.5309 4.8092 11.469 4.8092 10.6825 5.37717L5.74992 8.93869V17.0002C5.74993 18.2429 6.75728 19.2502 7.99992 19.2502H15.9999C17.2426 19.2502 18.2499 18.2429 18.2499 17.0002V8.93869ZM14.9999 15.2502C15.4141 15.2502 15.7499 15.586 15.7499 16.0002C15.7499 16.4144 15.4141 16.7502 14.9999 16.7502H8.99992C8.58571 16.7502 8.24992 16.4144 8.24992 16.0002C8.24992 15.586 8.58571 15.2502 8.99992 15.2502H14.9999ZM19.7499 17.0002C19.7499 19.0713 18.071 20.7502 15.9999 20.7502H7.99992C5.92886 20.7502 4.24993 19.0713 4.24992 17.0002V10.0227L3.43938 10.6086C3.1036 10.8511 2.63405 10.7754 2.39153 10.4397C2.14902 10.1039 2.22471 9.63434 2.56047 9.39181L9.80461 4.16037C11.1151 3.21412 12.8847 3.21412 14.1952 4.16037L21.4394 9.39181C21.7751 9.63434 21.8508 10.1039 21.6083 10.4397C21.3658 10.7754 20.8963 10.8511 20.5605 10.6086L19.7499 10.0227V17.0002Z"
        fill="currentColor"
      />
    </svg>
  ),
},
  {
  action: "search",
  label: "Search",
  icon: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
    >
      <path
        d="M15.25 10C15.25 7.10051 12.8995 4.75 10 4.75C7.10051 4.75 4.75 7.10051 4.75 10C4.75 12.8995 7.10051 15.25 10 15.25C12.8995 15.25 15.25 12.8995 15.25 10ZM16.75 10C16.75 11.5937 11.1961 13.0572 15.2725 14.2119L20.5303 19.4697C20.8232 19.7626 20.8232 20.2374 20.5303 20.5303C20.2374 20.8232 19.7626 20.8232 19.4697 20.5303L14.2119 15.2725C13.0572 16.1961 11.5937 16.75 10 16.75C6.27208 16.75 3.25 13.7279 3.25 10C3.25 6.27208 6.27208 3.25 10 3.25C13.7279 3.25 16.75 6.27208 16.75 10Z"
        fill="currentColor"
      />
    </svg>
  ),
},
 {
  href: "/resources",
  label: "Resources",
  icon: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
    >
      <path
        d="M20.25 12C20.25 7.44365 16.5563 3.75 12 3.75C7.44365 3.75 3.75 7.44365 3.75 12C3.75 16.5563 7.44365 20.25 12 20.25C16.5563 20.25 20.25 16.5563 20.25 12ZM14.8525 8.26465C15.0984 8.21547 15.353 8.29241 15.5303 8.46973C15.7076 8.64704 15.7845 8.90157 15.7354 9.14746L14.7354 14.1475C14.6759 14.4441 14.4441 14.6759 14.1475 14.7354L9.14746 15.7354C8.90157 15.7845 8.64704 15.7076 8.46973 15.5303C8.29241 15.353 8.21547 15.0984 8.26465 14.8525L9.26465 9.85254L9.29492 9.74512C9.3831 9.50101 9.59286 9.31672 9.85254 9.26465L14.8525 8.26465ZM10.6367 10.6367L9.95605 14.0439L13.3623 13.3623L14.0439 9.95605L10.6367 10.6367ZM21.75 12C21.75 17.3848 17.3848 21.75 12 21.75C6.61522 21.75 2.25 17.3848 2.25 12C2.25 6.61522 6.61522 2.25 12 2.25C17.3848 2.25 21.75 6.61522 21.75 12Z"
        fill="currentColor"
      />
    </svg>
  ),
},
  {
  href: "/connectors",
  label: "Connectors",
  icon: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
    >
      <path
        d="M10.5 13.5L13.5 10.5M7.25 16.75L5.75 18.25C4.50736 19.4926 2.49264 19.4926 1.25 18.25C0.00735974 17.0074 0.00735974 14.9926 1.25 13.75L5.75 9.25C6.99264 8.00736 9.00736 8.00736 10.25 9.25M13.75 14.75C14.9926 15.9926 17.0074 15.9926 18.25 14.75L22.75 10.25C23.9926 9.00736 23.9926 6.99264 22.75 5.75C21.5074 4.50736 19.4926 4.50736 18.25 5.75L16.75 7.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
},
];


type SidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const router  = useRouter();
  const pathname = usePathname();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projects  ,setProjects] = useState<Project[]>([])


  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();

        setProjects(data ?? []);
      } catch (error) {
        console.error("Failed to load projects" , error);
      }
    }

    loadProjects();
  }, []);
  return (
    <>
    <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)}
    />
    <aside
      className={`
        relative flex flex-col h-screen bg-black
        transition-all duration-200 ease-in-out
        ${isOpen ? "w-56 sm:w-70" : "w-14"}
      `}
    >
     
      <div className="flex items-center h-14  px-3">
       <button
         onClick={onToggle}
         className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
         aria-label={isOpen ? "Sidebar band karo" : "Sidebar kholo"}
           >
         <svg
           width="24"
           height="24"
           viewBox="0 0 24 24"
           fill="none"
           xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
            >
          <path
            d="M20.25 7C20.25 6.30964 19.6904 5.75 19 5.75H9.75V18.25H19C19.6904 18.25 20.25 17.6904 20.25 17V7ZM3.75 17C3.75 17.6904 4.30964 18.25 5 18.25H8.25V5.75H5C4.30964 5.75 3.75 6.30964 3.75 7V17ZM21.75 17C21.75 18.5188 20.5188 19.75 19 19.75H5C3.48122 19.75 2.25 18.5188 2.25 17V7C2.25 5.48122 3.48122 4.25 5 4.25H19C20.5188 4.25 21.75 5.48122 21.75 7V17Z"
            fill="currentColor"
           />
           </svg>
        </button>

        {isOpen && (
          <span className="ml-3 font-semibold text-white text-sm">Golt</span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-hidden">
        {navItems.map((item) => {
            if("action" in item) {
                return (
                    <button
                        key={item.label}
                        onClick={() => setSearchOpen(true)}
                        className="flex w-full items-center gap-3 px-2 py-2 rounded-md text-sm text-gray-400 "
                        >
                            <span>{item.icon}</span>

                            {isOpen && item.label}
                    </button>
                )
            }
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              title={!isOpen ? item.label : undefined}
              className={`
                flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors
                ${isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }
              `}
            >
              <span className="text-base shrink-0 w-5 text-center">{item.icon}</span>
              {isOpen && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        <div>
          <button
            onClick={() => {
              if (!isOpen) onToggle();
              setProjectsOpen((prev) => !prev);
            }}
            title={!isOpen ? "Projects" : undefined}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span className="shrink-0 w-5 flex items-center justify-center">
          <svg
           width="16"
           height="16"
           viewBox="0 0 24 24"
           fill="none"
           xmlns="http://www.w3.org/2000/svg"
           className="h-4 w-4"
          >
          <path
             d="M9.46967 6.46973C9.76256 6.17684 10.2373 6.17684 10.5302 6.46973L15.5302 11.4697C15.8231 11.7626 15.8231 12.2374 15.5302 12.5303L10.5302 17.5303C10.2373 17.8232 9.76256 17.8232 9.46967 17.5303C9.17678 17.2374 9.17678 16.7626 9.46967 16.4697L13.9394 12L9.46967 7.53028C9.17678 7.23738 9.17678 6.76262 9.46967 6.46973Z"
             fill="currentColor"
             />
            </svg>
          </span>
            {isOpen && (
              <>
                <span className="flex-1 text-left truncate">All Projects</span>
                <span className={`transition-transform duration-200 text-xs ${projectsOpen ? "rotate-180" : "rotate-0"}`}>
                
                </span>
              </>
            )}
          </button>

          {isOpen && projectsOpen && (
            <div className="ml-5 mt-1 space-y-1 border-l border-gray-700 pl-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`project/${project.id}`)}
                  className={`
                    flex items-center px-2 py-1.5 rounded-md text-sm transition-colors
                    ${pathname === `/project/${project.id}`
                      ? "text-white font-medium"
                      : "text-gray-500 hover:text-white hover:bg-gray-800"
                    }
                  `}
                >
                  {project.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="ml-4 mb-4"> 
        <UserDropdownMenu />
      </div>
    </aside>
    </>
  );
}