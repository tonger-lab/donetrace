import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { localizeError, useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { displayWidth, isValidSoulNote, SOUL_NOTE_MAX_WIDTH } from "../lib/soulNotes";
import { useTheme } from "../stores/theme";
import type { SoulNotesState } from "../types/pro";
import ConfirmDialog from "./ConfirmDialog";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

const btnCls =
  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";

/** 允许的切换时间（与 pro/ 后端 SOUL_NOTES_INTERVALS 一致） */
const INTERVALS: { secs: number; labelKey: MessageKey }[] = [
  { secs: 30, labelKey: "soulNotes.interval30s" },
  { secs: 60, labelKey: "soulNotes.interval1m" },
  { secs: 300, labelKey: "soulNotes.interval5m" },
  { secs: 1800, labelKey: "soulNotes.interval30m" },
  { secs: 3600, labelKey: "soulNotes.interval1h" },
];

type Msg = { kind: "ok" | "err" | "info"; text: string } | null;

/**
 * 心灵寄语（Soul Notes）管理面板（个人档案页的第二页签，仅官方安装包）：
 * 开关（默认关，删空不可开启）+ 切换时间 + 寄语列表（增删改）。
 * 所有业务校验（登录、宽度上限、删空自动关闭）在 pro/ 后端命令。
 */
export default function SoulNotesPanel({ loggedIn }: { loggedIn: boolean }) {
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);
  const theme = useTheme((s) => s.theme);
  const [state, setState] = useState<SoulNotesState | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!loggedIn) {
      setState(null);
      return;
    }
    const s = await api.pro.getSoulNotes(locale).catch(() => null);
    setState(s);
  }, [loggedIn, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  if (!loggedIn) {
    return (
      <section className="mt-6 rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("soulNotes.loginRequired")}</p>
      </section>
    );
  }

  const notes = state?.notes ?? [];
  const enabled = state?.enabled ?? false;
  const intervalSecs = state?.intervalSecs ?? 300;
  const canEnable = notes.length > 0;
  const newWidth = displayWidth(newText);
  const newValid = isValidSoulNote(newText);

  const setConfig = async (nextEnabled: boolean, nextInterval: number) => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await api.pro.setSoulNotesConfig(nextEnabled, nextInterval);
      setState(s);
      if (nextEnabled) setMsg({ kind: "ok", text: t("soulNotes.saved") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!newValid) return;
    setBusy(true);
    setMsg(null);
    try {
      setState(await api.pro.addSoulNote(newText));
      setNewText("");
      setMsg({ kind: "ok", text: t("soulNotes.saved") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
    setMsg(null);
  };

  const saveEdit = async () => {
    if (!editingId || !isValidSoulNote(editText)) return;
    setBusy(true);
    setMsg(null);
    try {
      setState(await api.pro.updateSoulNote(editingId, editText));
      setEditingId(null);
      setMsg({ kind: "ok", text: t("soulNotes.saved") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const wasEnabled = enabled;
    const hadOne = notes.length === 1;
    setBusy(true);
    setMsg(null);
    try {
      const s = await api.pro.deleteSoulNote(deletingId);
      setState(s);
      setMsg(
        wasEnabled && hadOne && !s.enabled
          ? { kind: "info", text: t("soulNotes.autoDisabled") }
          : null,
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setDeletingId(null);
    }
  };

  return (
    <section className="mt-6 space-y-5">
      {/* 开关 + 切换时间 */}
      <div className="rounded-lg border bg-card p-5">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="text-sm font-medium">{t("soulNotes.enable")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t("soulNotes.enableHint")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy || !canEnable}
            onChange={(e) => void setConfig(e.target.checked, intervalSecs)}
            className="size-4 shrink-0 accent-primary"
          />
        </label>
        {!canEnable && (
          <p className="mt-3 text-xs text-amber-600">{t("soulNotes.cannotEnable")}</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-muted-foreground">{t("soulNotes.interval")}</label>
          <select
            value={intervalSecs}
            disabled={busy}
            onChange={(e) => void setConfig(enabled, Number(e.target.value))}
            style={{ colorScheme: theme === "dark" ? "dark" : "light" }}
            className="rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {INTERVALS.map((it) => (
              <option key={it.secs} value={it.secs}>
                {t(it.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 添加 */}
      <div className="rounded-lg border bg-card p-5">
        <p className="text-xs text-muted-foreground">{t("soulNotes.limitHint")}</p>
        <div className="mt-2 flex gap-2">
          <input
            className={inputCls}
            value={newText}
            placeholder={t("soulNotes.addPlaceholder")}
            disabled={busy}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void add();
            }}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || !newValid}
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <p
          className={cn(
            "mt-1.5 text-right text-xs",
            newWidth > SOUL_NOTE_MAX_WIDTH ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {newWidth} / {SOUL_NOTE_MAX_WIDTH}
        </p>
      </div>

      {/* 列表 */}
      <div className="rounded-lg border bg-card p-5">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("soulNotes.empty")}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t("soulNotes.defaultsNote")}</p>
            <ul className="mt-2 space-y-2">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                >
                  {editingId === note.id ? (
                    <div className="min-w-0 flex-1">
                      <input
                        className={inputCls}
                        value={editText}
                        disabled={busy}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) void saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <p className="mt-1 text-right text-xs text-muted-foreground">
                        {displayWidth(editText)} / {SOUL_NOTE_MAX_WIDTH}
                      </p>
                      <div className="mt-1.5 flex justify-end gap-2">
                        <button type="button" onClick={() => void saveEdit()} disabled={busy} className={btnCls}>
                          {t("soulNotes.save")}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} disabled={busy} className={btnCls}>
                          {t("soulNotes.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="min-w-0 flex-1 break-words text-sm leading-relaxed">
                        {note.text}
                      </p>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          title={t("soulNotes.edit")}
                          disabled={busy}
                          onClick={() => startEdit(note.id, note.text)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title={t("soulNotes.delete")}
                          disabled={busy}
                          onClick={() => setDeletingId(note.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {msg && (
        <p
          className={cn(
            "text-sm",
            msg.kind === "ok" && "text-emerald-600",
            msg.kind === "err" && "text-destructive",
            msg.kind === "info" && "text-amber-600",
          )}
        >
          {msg.text}
        </p>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title={t("soulNotes.confirmDeleteTitle")}
        description={t("soulNotes.confirmDeleteBody")}
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletingId(null)}
      />
    </section>
  );
}
