import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import type { ProStatus, SoulNotesState } from "../types/pro";

/** 打字机节奏：每字符约 275ms，一字一顿的书写感 */
const TYPE_MS_PER_CHAR = 275;

/** 内容级相等比较：轮询返回的对象每次都不同，只有真正变化才更新状态 */
function sameState(a: SoulNotesState | null, b: SoulNotesState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.enabled === b.enabled &&
    a.intervalSecs === b.intervalSecs &&
    a.notes.length === b.notes.length &&
    a.notes.every((n, i) => n.id === b.notes[i]?.id && n.text === b.notes[i]?.text)
  );
}

/**
 * 侧栏品牌语（DoneTrace 下方一行）：
 * - 开源构建：固定显示品牌语（brand.tagline）
 * - Pro 构建且已登录且「心灵寄语」开启：按设定时间随机轮换显示寄语（最多 2 行），
 *   切换时以打字机效果逐字书写
 * 每 5 秒同步一次登录/寄语状态（与个人档案页同频）；仅内容真正变化时才更新，
 * 避免轮询重置轮换计时器。
 */
export default function BrandTagline() {
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);
  const [proBuild, setProBuild] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [soul, setSoul] = useState<SoulNotesState | null>(null);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    api.pro
      .isProBuild()
      .then(setProBuild)
      .catch(() => setProBuild(false));
  }, []);

  useEffect(() => {
    if (!proBuild) return;
    let stopped = false;
    const tick = async () => {
      const s = await api.pro.status().catch(() => null);
      if (stopped) return;
      setStatus(s);
      if (s?.loggedIn) {
        const sn = await api.pro.getSoulNotes(locale).catch(() => null);
        if (stopped) return;
        // 内容未变化时保持原引用：轮换计时器不被轮询重置
        setSoul((prev) => (sameState(prev, sn) ? prev : sn));
      } else {
        setSoul(null);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 5000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [proBuild, locale]);

  const notes = useMemo(() => soul?.notes ?? [], [soul]);
  const enabled = !!soul?.enabled && notes.length > 0 && !!status?.loggedIn;

  // 按设定时间随机轮换（避免与上一条重复；间隔下限 5 秒）
  useEffect(() => {
    if (!enabled || !soul) return;
    const count = notes.length;
    const pick = (avoid: number) => {
      if (count <= 1) return 0;
      let i = avoid;
      while (i === avoid) i = Math.floor(Math.random() * count);
      return i;
    };
    setIdx((prev) => pick(prev));
    const ms = Math.max(5, soul.intervalSecs) * 1000;
    const id = setInterval(() => setIdx((prev) => pick(prev)), ms);
    return () => clearInterval(id);
  }, [enabled, soul, notes]);

  const shown = enabled ? notes[Math.min(idx, notes.length - 1)]?.text : undefined;

  // 打字机效果：切换寄语时从空逐字打出（含闪烁光标）；固定品牌语直接显示
  useEffect(() => {
    if (!shown) {
      setTyped("");
      return;
    }
    const chars = Array.from(shown);
    setTyped("");
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTyped(chars.slice(0, i).join(""));
      if (i >= chars.length) clearInterval(timer);
    }, TYPE_MS_PER_CHAR);
    return () => clearInterval(timer);
  }, [shown]);

  const typing = !!shown && typed.length < Array.from(shown).length;

  return (
    <p
      className={
        shown
          ? "line-clamp-2 min-h-[2rem] break-words text-xs text-muted-foreground"
          : "break-words text-xs text-muted-foreground"
      }
    >
      {shown ? (
        <>
          {typed}
          {typing && <span className="animate-pulse">▍</span>}
        </>
      ) : (
        t("brand.tagline")
      )}
    </p>
  );
}
