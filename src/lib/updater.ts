import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export {
  lastCheckKey,
  markCheckedToday,
  shouldAutoCheck,
  todayKey,
} from "./updateGate";

export type UpdateCapability = "full" | "website";

export async function currentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "";
  }
}

/** 更新能力：full = 应用内下载安装；website = 引导官网（deb 等格式） */
export async function getUpdateCapability(): Promise<UpdateCapability> {
  try {
    return await invoke<UpdateCapability>("get_update_capability");
  } catch {
    return "website";
  }
}

/** 待安装的更新对象（检查与下载复用，避免二次网络请求） */
let pending: Update | null = null;

/** 检查更新：无新版本返回 null；有则暂存对象并返回版本信息 */
export async function checkForUpdate(): Promise<{ version: string; body?: string } | null> {
  pending = null;
  const update = await check();
  if (!update) return null;
  pending = update;
  return { version: update.version, body: update.body ?? undefined };
}

export type DownloadProgress = number | null;

/** 下载并安装暂存的更新；onProgress 收到 0~1 进度（未知总量时为 null） */
export async function downloadPending(
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (!pending) {
    const update = await check();
    if (!update) throw new Error("no-update");
    pending = update;
  }
  let total = 0;
  await pending.downloadAndInstall((event) => {
    if (!onProgress) return;
    if (event.event === "Started") {
      const d = event.data as { contentLength?: number };
      total = d.contentLength ?? 0;
    } else if (event.event === "Progress") {
      const d = event.data as { chunkLength: number };
      onProgress(total > 0 ? Math.min(1, d.chunkLength / total) : null);
    }
  });
  pending = null;
}

/** 重启应用（AppImage 原地更新后需要） */
export async function relaunchApp(): Promise<void> {
  await relaunch();
}

/** 系统默认浏览器打开官网（免费版下载入口；Pro 另有 pro_open_website） */
export async function openWebsite(url = "https://donetrace.app"): Promise<void> {
  try {
    await invoke("open_url", { url });
  } catch {
    window.open(url, "_blank");
  }
}
