import {
  disconnectGithub,
  fetchGithubStatus,
  type GithubStatus,
  type PushResult,
  pushProjectToGithub,
  redirectToGithubConnect,
} from '@/app/lib/github-api';
import { create } from 'zustand';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    projectId: string;
}

type File = {
    path: string;
    content: string;
}

type Project = {
    id: string;
    name: string;
    previewUrl?: string;
}

interface GithubState {
  connected: boolean;
  username: string | null;
  statusLoading: boolean;
  statusError: string | null;

  pushing: boolean;
  pushError: string | null;
  lastPushResult: PushResult | null;
}

interface  GithubActions {
    loadStatus  : () => Promise<void>;
    connect : () => void;
    disconnect : () => Promise<void>
    push : (projectId : string, repoName : string) => Promise<PushResult | null>
    resetPush: () => void;
    reset: () => void;
}

const githubInitialState: GithubState = {
  connected: false,
  username: null,
  statusLoading: false,
  statusError: null,

  pushing: false,
  pushError: null,
  lastPushResult: null,
};



type Store = {

    messages:        Message[];
    files:           File[];
    selectedFile:    File | null;
    isAgentThinking: boolean;
    previewUrl:      string | null;
    previewNonce:    number;
    activeTab:       string;
    currentProject:  Project | null;

    setMessages:        (messages: Message[]) => void;
    addMessage:         (message: Message) => void;
    appendToken:        (text: string) => void;
    setLastAssistantContent: (content: string) => void;
    setFiles:           (files: File[]) => void;
    upsertFile:         (file: File) => void;
    setSelectedFile:    (file: File | null) => void;
    setIsAgentThinking: (bool: boolean) => void;
    setPreviewUrl:      (url: string | null) => void;
    reloadPreview:      () => void;
    setActiveTab:       (tab: string) => void;
    setCurrentProject:  (project: Project) => void;
}

export const useProjectStore = create<Store>((set) => ({

    messages:        [],
    files:           [],
    selectedFile:    null,
    isAgentThinking: false,
    previewUrl:      null,
    previewNonce:    0,
    activeTab:       'preview',
    currentProject:  null,


    setMessages: (messages) => set({ messages }),

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    appendToken: (text) => set((state) => {
        const messages = [...state.messages];
        const last = messages[messages.length - 1];

        if (last && last.role === 'assistant') {
            messages[messages.length - 1] = {
                ...last,
                content: last.content + text  
            };
        }

        return { messages };
    }),

    setLastAssistantContent: (content) => set((state) => {
        const messages = [...state.messages];
        const last = messages[messages.length - 1];

        if (last && last.role === 'assistant') {
            messages[messages.length - 1] = { ...last, content };
        }

        return { messages };
    }),

    setFiles: (files) => set({ files }),

    upsertFile: (file) => set((state) => {
        const exists = state.files.findIndex((f) => f.path === file.path);

        if (exists !== -1) {
            
            const files = [...state.files];
            files[exists] = file;
            return { files };
        }

        return { files: [...state.files, file] };
    }),

    setSelectedFile:    (file)    => set({ selectedFile: file }),
    setIsAgentThinking: (bool)    => set({ isAgentThinking: bool }),
    setPreviewUrl:      (url)     => set({ previewUrl: url }),
    reloadPreview:      ()        => set((s) => ({ previewNonce: s.previewNonce + 1 })),
    setActiveTab:       (tab)     => set({ activeTab: tab }),
    setCurrentProject:  (project) => set({ currentProject: project }),
}));


export const useGithubStore = create<GithubState & GithubActions>((set) => ({
  ...githubInitialState,

  loadStatus: async () => {

    set({ connected: false, username: null, statusLoading: true, statusError: null });
    try {
      const status: GithubStatus = await fetchGithubStatus();
      set({
        connected: status.connected,
        username: status.username,
        statusLoading: false,
      });
    } catch (err) {

      set({
        connected: false,
        username: null,
        statusLoading: false,
        statusError: err instanceof Error ? err.message : "Failed to load status",
      });
    }
  },

  reset: () => set({ ...githubInitialState }),
 
  connect: () => {
    redirectToGithubConnect();
  },
 
  disconnect: async () => {
    set({ statusLoading: true, statusError: null });
    try {
      await disconnectGithub();
      set({ connected: false, username: null, statusLoading: false });
    } catch (err) {
      set({
        statusLoading: false,
        statusError: err instanceof Error ? err.message : "Failed to disconnect",
      });
    }
  },

  push: async (projectId, repoName) => {
    set({ pushing: true, pushError: null, lastPushResult: null });
    try {
      const result = await pushProjectToGithub({ projectId, repoName });
      set({ pushing: false, lastPushResult: result });
      return result;
    } catch (err) {
      set({
        pushing: false,
        pushError: err instanceof Error ? err.message : "Push failed",
      });
      return null;
    }
  },
 
  resetPush: () => {
    set({ pushing: false, pushError: null, lastPushResult: null });
  },
}));
 
