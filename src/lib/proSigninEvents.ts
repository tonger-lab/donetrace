import { listen } from "@tauri-apps/api/event";
import { useProSignin } from "../stores/proSignin";

let started = false;

type SigninStateEvent = { phase: "start" | "ok" | "fail"; error?: string };

/**
 * 订阅 Rust 端 `pro://signin-state` 事件：官网深链登录转移（donetrace://auth?tt=…）
 * 的开始 / 成功 / 失败。开始 → 全局「正在登录中…」遮罩并锁定交互；
 * 结束 → 徽章即时刷新登录状态。幂等：应用生命周期内只注册一次。
 */
export function startProSigninListener(): void {
  if (started) return;
  started = true;
  void listen<SigninStateEvent>("pro://signin-state", (event) => {
    const p = event.payload?.phase;
    if (p === "start") {
      useProSignin.getState().start();
    } else if (p === "ok") {
      useProSignin.getState().ok();
    } else if (p === "fail") {
      useProSignin.getState().fail(event.payload?.error ?? "unknown error");
    }
  });
}
