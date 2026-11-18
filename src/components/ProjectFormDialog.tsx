import { ImagePlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import Modal from "./ui/Modal";
import IconPickerDialog from "./IconPickerDialog";
import ProjectIcon from "./ProjectIcon";
import { cn } from "../lib/cn";
import { isImagePath } from "../lib/icon";
import { useI18n } from "../i18n";
import type { Project } from "../types/project";

export interface ProjectFormData {
  name: string;
  icon: string;
  description: string;
}

interface ProjectFormDialogProps {
  open: boolean;
  title: string;
  /** null = 新建 */
  initial: Project | null;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => void;
}

const EMOJIS = [
  "📁", "💼", "💻", "🎨", "📚", "🏃", "🎯", "🧪",
  "🚀", "💰", "🏠", "🎮", "✍️", "📈", "🧠", "🌱",
  "🎵", "🛠️", "❤️", "⭐", "📝", "🔧", "🎓", "☕",
];

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export default function ProjectFormDialog({
  open,
  title,
  initial,
  error,
  onClose,
  onSubmit,
}: ProjectFormDialogProps) {
  const t = useI18n((s) => s.t);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setEmoji(initial && !isImagePath(initial.icon) ? initial.icon : "📁");
    setCustomIcon(initial && isImagePath(initial.icon) ? initial.icon : null);
    setDescription(initial?.description ?? "");
  }, [open, initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      icon: customIcon ?? emoji,
      description,
    });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={title}>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("projectForm.name")}</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projectForm.namePlaceholder")}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("projectForm.icon")}</label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ImagePlus className="size-3.5" /> {t("projectForm.uploadCustom")}
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setEmoji(item);
                    setCustomIcon(null);
                  }}
                  className={cn(
                    "flex items-center justify-center rounded-md p-1.5 text-2xl leading-none hover:bg-accent",
                    !customIcon && emoji === item && "bg-accent ring-1 ring-ring",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("projectForm.currentIcon")}</label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3">
              <ProjectIcon icon={customIcon ?? emoji} className="size-6" />
              {customIcon && (
                <span className="truncate text-xs text-muted-foreground">
                  {t("projectForm.customImage")}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("projectForm.description")}</label>
            <textarea
              className={`${inputCls} min-h-20 resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projectForm.descriptionPlaceholder")}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <IconPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(dataUrl) => {
          setCustomIcon(dataUrl);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
