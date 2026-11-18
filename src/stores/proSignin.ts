import { create } from "zustand";

export type ProSigninPhase = "idle" | "signing-in" | "failed";

interface ProSigninState {
  /** idle = 无操作；signing-in = 官网深链登录转移进行中（UI 锁定）；failed = 转移失败（等待用户确认） */
  phase: ProSigninPhase;
  error: string | null;
  /** 每次转移完成（ok/fail）+1：供徽章等订阅方立即刷新登录状态，不用等 5 秒轮询 */
  seq: number;
  start: () => void;
  ok: () => void;
  fail: (error: string) => void;
  dismiss: () => void;
}

export const useProSignin = create<ProSigninState>((set) => ({
  phase: "idle",
  error: null,
  seq: 0,
  start: () => set({ phase: "signing-in", error: null }),
  ok: () => set((s) => ({ phase: "idle", error: null, seq: s.seq + 1 })),
  fail: (error) => set((s) => ({ phase: "failed", error, seq: s.seq + 1 })),
  dismiss: () => set({ phase: "idle", error: null }),
}));
