import Modal from "./ui/Modal";
import { useI18n } from "../i18n";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useI18n((s) => s.t);
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={
            danger
              ? "rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:opacity-90"
              : "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          }
        >
          {confirmText ?? t("common.confirm")}
        </button>
      </div>
    </Modal>
  );
}
