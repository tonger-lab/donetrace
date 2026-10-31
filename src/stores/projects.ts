import { create } from "zustand";
import { api } from "../lib/api";
import type { Project, ProjectInput } from "../types/project";

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  load: (includeArchived?: boolean) => Promise<void>;
  create: (input: ProjectInput) => Promise<Project>;
  update: (id: string, input: ProjectInput) => Promise<Project>;
  remove: (id: string) => Promise<void>;
  move: (id: string, direction: "up" | "down") => Promise<void>;
  launch: (id: string) => Promise<void>;
  unlaunch: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  reactivate: (id: string) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  load: async (includeArchived = false) => {
    set({ loading: true, error: null });
    try {
      const projects = await api.projects.list(includeArchived);
      set({ projects, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  create: async (input) => {
    const project = await api.projects.create(input);
    await get().load();
    return project;
  },

  update: async (id, input) => {
    const project = await api.projects.update(id, input);
    await get().load();
    return project;
  },

  remove: async (id) => {
    await api.projects.remove(id);
    await get().load();
  },

  move: async (id, direction) => {
    await api.projects.move(id, direction);
    await get().load();
  },

  launch: async (id) => {
    await api.projects.launch(id);
    await get().load();
  },

  unlaunch: async (id) => {
    await api.projects.unlaunch(id);
    await get().load();
  },

  archive: async (id) => {
    await api.projects.archive(id);
    await get().load();
  },

  reactivate: async (id) => {
    await api.projects.reactivate(id);
    await get().load();
  },
}));
