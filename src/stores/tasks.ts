import { create } from "zustand";
import { api } from "../lib/api";
import type { CreateTaskInput, Task, UpdateTaskInput } from "../types/task";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  load: (projectId?: string) => Promise<void>;
  create: (input: CreateTaskInput) => Promise<Task>;
  update: (id: string, input: UpdateTaskInput) => Promise<Task>;
  remove: (id: string) => Promise<void>;
  toggleDone: (id: string, done: boolean) => Promise<Task>;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  loading: false,
  error: null,

  load: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const tasks = await api.tasks.list(projectId);
      set({ tasks, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  create: async (input) => {
    const task = await api.tasks.create(input);
    set((s) => ({ tasks: [...s.tasks, task], error: null }));
    return task;
  },

  update: async (id, input) => {
    const task = await api.tasks.update(id, input);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? task : t)), error: null }));
    return task;
  },

  remove: async (id) => {
    await api.tasks.remove(id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), error: null }));
  },

  toggleDone: async (id, done) => {
    const task = await api.tasks.toggleDone(id, done);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? task : t)), error: null }));
    return task;
  },
}));
