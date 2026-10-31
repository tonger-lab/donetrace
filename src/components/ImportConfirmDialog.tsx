import Modal from "./ui/Modal";
import { useI18n } from "../i18n";
import type { ImportPreview } from "../types/backup";

interface ImportConfirmDialogProps {
  open: boolean;
  preview: ImportPreview | null;
  onCancel: () => void;
  onImport: (mode: "merge" | "replace") => void;
}

/** 导入预览确认：展示数量，选择合并或整体替换 */
export default function ImportConfirmDialog({
  open,
  preview,
  onCancel,
  onImport,
}: ImportConfirmDialogProps) {
  const t = useI18n((s) => s.t);
  const rows = preview
    ? [
        [t("nav.projects"), preview.projects, preview.newProjects],
        [t("nav.tasks"), preview.tasks, preview.newTasks],
        [t("import.reports"), preview.reports, preview.newReports],
        [t("import.logs"), preview.logs, preview.newLogs],
      ]
    : [];

  return (
    <Modal open={open} onClose={onCancel} title={t("import.title")} className="max-w-lg">
      <p className="text-sm text-muted-foreground">{t("import.hint")}</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1.5 font-medium">{t("import.type")}</th>
            <th className="py-1.5 font-medium">{t("import.fileCount")}</th>
            <th className="py-1.5 font-medium">{t("import.newCount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, total, added]) => (
            <tr key={label} className="border-b">
              <td className="py-1.5">{label}</td>
              <td className="py-1.5">{total}</td>
              <td className="py-1.5">{added}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => onImport("replace")}
          className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
        >
          {t("import.replace")}
        </button>
        <button
          type="button"
          onClick={() => onImport("merge")}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          {t("import.merge")}
        </button>
      </div>
    </Modal>
  );
}
