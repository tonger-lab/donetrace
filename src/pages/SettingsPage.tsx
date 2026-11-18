import { Download, PlugZap, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import ClearDataDialog from "../components/ClearDataDialog";
import ImportConfirmDialog from "../components/ImportConfirmDialog";
import Select from "../components/Select";
import UpdateSection from "../components/UpdateSection";
import { localizeError, useI18n, type LanguageMode } from "../i18n";
import { api } from "../lib/api";
import { useTheme } from "../stores/theme";
import type { Theme } from "../lib/theme";
import type { ImportPreview, ImportSummary } from "../types/backup";
import type { AiProvider, DeepSeekConfig } from "../types/settings";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

/** 提供商预设：一键填充 base URL + 默认模型；除 Anthropic（原生协议）外均为 OpenAI 兼容协议。
 *  官方 AI（DoneTrace AI）不再是提供商预设，而是个人档案页的独立开关（仅 Pro）。 */
type Preset = {
  id: string;
  labelKey: string;
  baseUrl: string;
  model: string;
  provider: AiProvider;
};

const PRESETS: Preset[] = [
  { id: "deepseek", labelKey: "settings.aiPresetDeepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", provider: "openai_compatible" },
  { id: "openai", labelKey: "settings.aiPresetOpenai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o", provider: "openai_compatible" },
  { id: "anthropic", labelKey: "settings.aiPresetAnthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5", provider: "anthropic" },
  { id: "gemini", labelKey: "settings.aiPresetGemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", provider: "openai_compatible" },
  { id: "mistral", labelKey: "settings.aiPresetMistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-large-latest", provider: "openai_compatible" },
  { id: "openrouter", labelKey: "settings.aiPresetOpenrouter", baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4.5", provider: "openai_compatible" },
  { id: "groq", labelKey: "settings.aiPresetGroq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", provider: "openai_compatible" },
  { id: "ollama", labelKey: "settings.aiPresetOllama", baseUrl: "http://localhost:11434/v1", model: "llama3.1", provider: "openai_compatible" },
  { id: "custom", labelKey: "settings.aiPresetCustom", baseUrl: "", model: "", provider: "openai_compatible" },
];

export default function SettingsPage() {
  const t = useI18n((s) => s.t);
  const languageMode = useI18n((s) => s.mode);
  const setMode = useI18n((s) => s.setMode);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);

  const [config, setConfig] = useState<DeepSeekConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-chat");
  const [provider, setProvider] = useState<AiProvider>("openai_compatible");
  const [presetId, setPresetId] = useState("deepseek");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // 数据管理
  const [busy, setBusy] = useState(false);
  const [dataStatus, setDataStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importPath, setImportPath] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    api.settings
      .getDeepseekConfig()
      .then((c) => {
        setConfig(c);
        setBaseUrl(c.baseUrl);
        setModel(c.model);
        setProvider(c.provider);
        setPresetId(
          PRESETS.find((p) => p.provider === c.provider && p.baseUrl === c.baseUrl && p.model === c.model)
            ?.id ?? "custom",
        );
      })
      .catch((err) => setStatus({ kind: "err", text: localizeError(t, String(err)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 选择预设：填充地址/模型并切换协议 */
  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setProvider(preset.provider);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await api.settings.setDeepseekConfig({
        apiKey: apiKey.trim() || null,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        provider,
      });
      setApiKey("");
      const c = await api.settings.getDeepseekConfig();
      setConfig(c);
      setBaseUrl(c.baseUrl);
      setModel(c.model);
      setStatus({ kind: "ok", text: t("settings.saved") });
    } catch (err) {
      setStatus({ kind: "err", text: localizeError(t, String(err)) });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const msg = await api.settings.testConnection();
      setStatus({ kind: "ok", text: msg });
    } catch (err) {
      setStatus({ kind: "err", text: localizeError(t, String(err)) });
    } finally {
      setTesting(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    setDataStatus(null);
    try {
      const path = await api.backup.export();
      if (path) {
        setDataStatus({ kind: "ok", text: t("settings.exportedTo", { path }) });
      }
    } catch (err) {
      setDataStatus({ kind: "err", text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const doPickImport = async () => {
    setDataStatus(null);
    try {
      const path = await api.backup.pickFile();
      if (!path) return;
      const p = await api.backup.preview(path);
      setImportPath(path);
      setPreview(p);
    } catch (err) {
      setDataStatus({ kind: "err", text: String(err) });
    }
  };

  const doImport = async (mode: "merge" | "replace") => {
    if (!importPath) return;
    setBusy(true);
    setDataStatus(null);
    try {
      const summary: ImportSummary = await api.backup.import(importPath, mode);
      setDataStatus({
        kind: "ok",
        text:
          t("settings.importSummary", {
            pc: summary.projectsCreated,
            pu: summary.projectsUpdated,
            tc: summary.tasksCreated,
            tu: summary.tasksUpdated,
            rc: summary.reportsCreated,
            ru: summary.reportsUpdated,
            lc: summary.logsCreated,
            lu: summary.logsUpdated,
          }) + t("settings.importRefreshNote"),
      });
    } catch (err) {
      setDataStatus({ kind: "err", text: String(err) });
    } finally {
      setPreview(null);
      setImportPath(null);
      setBusy(false);
    }
  };

  const doClear = async () => {
    setBusy(true);
    setDataStatus(null);
    try {
      await api.backup.clear();
      setDataStatus({ kind: "ok", text: t("settings.cleared") });
    } catch (err) {
      setDataStatus({ kind: "err", text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-2xl font-semibold">{t("settings.title")}</h2>

      {/* 语言 */}
      <section className="mt-6 rounded-lg border bg-card p-5">
        <h3 className="font-medium">{t("settings.languageTitle")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.languageHint")}</p>
        <div className="mt-4 max-w-60">
          <Select
            value={languageMode}
            onChange={(v) => void setMode(v as LanguageMode)}
            options={[
              { value: "auto", label: t("settings.languageAuto") },
              { value: "en", label: t("settings.languageEn") },
              { value: "zh-CN", label: t("settings.languageZh") },
            ]}
          />
        </div>
      </section>

      {/* 颜色模式（原左下角入口移入设置） */}
      <section className="mt-6 rounded-lg border bg-card p-5">
        <h3 className="font-medium">{t("settings.themeTitle")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.themeHint")}</p>
        <div className="mt-4 max-w-60">
          <Select
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
            options={[
              { value: "light", label: t("theme.light") },
              { value: "dark", label: t("theme.dark") },
            ]}
          />
        </div>
      </section>

      {/* Pro 账户区块已迁至个人档案页（左下角账户徽章 → 个人档案） */}

      {/* AI 提供商（BYOK 多提供商；官方 AI 开关在个人档案页，仅 Pro） */}
      <section className="mt-6 rounded-lg border bg-card p-5">
        <h3 className="font-medium">{t("settings.deepseekTitle")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.aiProviderHint")}</p>
        <form onSubmit={save} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("settings.aiProvider")}</label>
            <Select
              value={presetId}
              onChange={(v) => applyPreset(v)}
              options={PRESETS.map((p) => ({
                value: p.id,
                label: t(p.labelKey as Parameters<typeof t>[0]),
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("settings.apiKey")}</label>
            <input
              className={inputCls}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                config?.hasApiKey ? t("settings.apiKeyConfigured") : t("settings.apiKeyPlaceholder")
              }
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("settings.baseUrl")}</label>
              <input
                className={inputCls}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("settings.model")}</label>
              <input
                className={inputCls}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-chat"
              />
            </div>
          </div>
          {status && (
            <p
              className={
                status.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-destructive"
              }
            >
              {status.text}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-4" /> {saving ? t("common.saving") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => void test()}
              disabled={testing}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              <PlugZap className="size-4" /> {testing ? t("common.testing") : t("settings.testConnection")}
            </button>
          </div>
        </form>
      </section>

      {/* 数据管理 */}
      <section className="mt-6 rounded-lg border bg-card p-5">
        <h3 className="font-medium">{t("settings.dataTitle")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.dataHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void doExport()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Download className="size-4" /> {t("settings.exportData")}
          </button>
          <button
            type="button"
            onClick={() => void doPickImport()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Upload className="size-4" /> {t("settings.importData")}
          </button>
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="size-4" /> {t("settings.clearAll")}
          </button>
        </div>
        {dataStatus && (
          <p
            className={
              dataStatus.kind === "ok"
                ? "mt-3 break-all text-sm text-emerald-600"
                : "mt-3 text-sm text-destructive"
            }
          >
            {dataStatus.text}
          </p>
        )}
      </section>

      {/* 应用内更新（免费版与 Pro 共用；deb 引导官网） */}
      <UpdateSection />

      <p className="mt-8 text-center text-xs text-muted-foreground">{t("brand.footer")}</p>

      <ImportConfirmDialog
        open={preview !== null}
        preview={preview}
        onCancel={() => {
          setPreview(null);
          setImportPath(null);
        }}
        onImport={(mode) => void doImport(mode)}
      />

      <ClearDataDialog
        open={clearOpen}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          void doClear();
        }}
      />
    </div>
  );
}
