import { useState } from "react";
import Modal from "./ui/Modal";
import { useI18n } from "../i18n";

interface ClearDataDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 一键清除：输入品牌名二次确认 */
export default function ClearDataDialog({ open, onCancel, onConfirm }: ClearDataDialogProps) {
  const t = useI18n((s) => s.t);
  const [text, setText] = useState("");
  const word = t("brand.confirmWord");
  const ready = text === word;

  const handleCancel = () => {
    setText("");
    onCancel();
  };

  return (
    <Modal open={open} onClose={handleCancel} title={t("clear.title")}>
      <p className="text-sm text-muted-foreground">
        {t("clear.warningPre")}
        <b>{t("clear.warningBold")}</b>
        {t("clear.warningPost")}
      </p>
      <p className="mt-3 text-sm">{t("clear.confirmPrompt", { word })}</p>
      <input
        className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={word}
        autoFocus
      />
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setText("");
            onConfirm();
          }}
          className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:opacity-90 disabled:opacity-50"
        >
          {t("clear.confirmBtn")}
        </button>
      </div>
    </Modal>
  );
}
