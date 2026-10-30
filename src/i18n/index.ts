/**
 * 轻量 i18n 运行时：词库为扁平 key（英文为真源，中文由类型强制完整）。
 * 语言来源：设置(settings 表 lang 键) → 未设置时按操作系统语言检测，非中文一律英文。
 */
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { create } from "zustand";
import { api } from "../lib/api";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import type { LanguageMode, Locale } from "./types";

export type { LanguageMode, Locale } from "./types";
export type MessageKey = keyof typeof en;
export type TFunc = (key: MessageKey, vars?: Record<string, string | number>) => string;

const CATALOGS: Record<Locale, Record<MessageKey, string>> = {
  en: en as Record<MessageKey, string>,
  "zh-CN": zhCN,
};

function detectLocale(sysLocale: string | null | undefined): Locale {
  return sysLocale?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

async function systemLocale(): Promise<string | null> {
  try {
    return await api.settings.getSystemLocale();
  } catch {
    return typeof navigator !== "undefined" ? navigator.language ?? null : null;
  }
}

function applyLocale(locale: Locale) {
  dayjs.locale(locale === "zh-CN" ? "zh-cn" : "en");
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

/** 每次语言变化时重建 t，保证订阅 `s.t` 的组件（如左侧菜单）立即重渲染 */
function makeT(locale: Locale): TFunc {
  return (key, vars) => {
    const msg = CATALOGS[locale][key] ?? en[key] ?? String(key);
    if (!vars) return msg;
    return msg.replace(/\{(\w+)\}/g, (m, name: string) =>
      vars[name] !== undefined ? String(vars[name]) : m,
    );
  };
}

interface I18nState {
  locale: Locale;
  mode: LanguageMode;
  ready: boolean;
  init: () => Promise<void>;
  setMode: (mode: LanguageMode) => Promise<void>;
  t: TFunc;
}

export const useI18n = create<I18nState>((set) => ({
  locale: "en",
  mode: "auto",
  ready: false,

  init: async () => {
    let mode: LanguageMode = "auto";
    try {
      const stored = await api.settings.getLanguage();
      if (stored === "en" || stored === "zh-CN" || stored === "auto") mode = stored;
    } catch {
      /* 设置读取失败按 auto 处理 */
    }
    const locale = mode === "auto" ? detectLocale(await systemLocale()) : mode;
    applyLocale(locale);
    set({ locale, mode, ready: true, t: makeT(locale) });
  },

  setMode: async (mode) => {
    try {
      await api.settings.setLanguage(mode);
    } catch {
      /* 持久化失败仍切换本次会话 */
    }
    const locale = mode === "auto" ? detectLocale(await systemLocale()) : mode;
    applyLocale(locale);
    set({ locale, mode, t: makeT(locale) });
  },

  t: makeT("en"),
}));

/** 把 Rust 端返回的错误码（形如 ai.no_api_key）翻译为当前语言；非错误码原样返回。 */
export function localizeError(t: TFunc, msg: string): string {
  const key = `errors.${msg}` as MessageKey;
  return msg.includes(".") && key in en ? t(key) : msg;
}
