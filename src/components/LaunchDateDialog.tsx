import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import Modal from "./ui/Modal";

interface LaunchDateDialogProps {
  open: boolean;
  /** 初始日期（YYYY-MM-DD），null 表示今天（首次上线） */
  initialDate?: string | null;
  onClose: () => void;
  /** 确认后返回 YYYY-MM-DD */
  onConfirm: (date: string) => void;
}

/** 上线日期选择：项目实际上线时间可能与点击当天不同，用户可自选年-月-日 */
export default function LaunchDateDialog({
  open,
  initialDate,
  onClose,
  onConfirm,
}: LaunchDateDialogProps) {
  const t = useI18n((s) => s.t);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(initialDate || dayjs().format("YYYY-MM-DD"));
    setError(null);
  }, [open, initialDate]);

  const confirm = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError(t("launchDate.invalid"));
      return;
    }
    onConfirm(date);
  };

  return (
    <Modal open={open} onClose={onClose} title={t("launchDate.title")} className="max-w-sm">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("launchDate.label")}</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setError(null);
          }}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t("launchDate.hint")}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          {t("common.confirm")}
        </button>
      </div>
    </Modal>
  );
}
