import { create } from "zustand";
import {
  checkForUpdate,
  currentVersion,
  downloadPending,
  getUpdateCapability,
  relaunchApp,
  type UpdateCapability,
} from "../lib/updater";

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "done"
  | "error";

interface UpdaterState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  notes: string | null;
  /** 0~1 下载进度；未知总量时为 null */
  progress: number | null;
  error: string | null;
  capability: UpdateCapability | null;
  /** 最近一次检查无新版本（用于展示「已是最新」） */
  upToDate: boolean;
  /** 初始化：读取当前版本与更新能力（deb → website 引导官网） */
  init: () => Promise<void>;
  /** 手动/自动检查：返回是否发现新版本 */
  check: () => Promise<boolean>;
  /** 下载并安装（用户已确认） */
  download: () => Promise<void>;
  /** 安装完成后重启应用（AppImage 原地更新需要） */
  relaunch: () => Promise<void>;
  reset: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  status: "idle",
  currentVersion: "",
  availableVersion: null,
  notes: null,
  progress: null,
  error: null,
  capability: null,
  upToDate: false,

  init: async () => {
    const [version, capability] = await Promise.all([
      currentVersion(),
      getUpdateCapability(),
    ]);
    set({ currentVersion: version, capability });
  },

  check: async () => {
    set({ status: "checking", error: null, progress: null, upToDate: false });
    try {
      const info = await checkForUpdate();
      if (info) {
        set({
          status: "available",
          availableVersion: info.version,
          notes: info.body ?? null,
        });
        return true;
      }
      set({ status: "idle", upToDate: true });
      return false;
    } catch (e) {
      set({ status: "error", error: String(e) });
      return false;
    }
  },

  download: async () => {
    set({ status: "downloading", error: null, progress: 0 });
    try {
      await downloadPending((p) => set({ progress: p }));
      // Windows NSIS：安装器接管后应用退出，通常到不了这里；
      // AppImage：原地替换成功，提示重启
      set({ status: "done", progress: null });
    } catch (e) {
      set({ status: "error", error: String(e), progress: null });
    }
  },

  relaunch: async () => {
    await relaunchApp().catch(() => {});
  },

  reset: () => {
    set({
      status: "idle",
      error: null,
      progress: null,
      availableVersion: null,
      notes: null,
      upToDate: false,
    });
  },
}));
