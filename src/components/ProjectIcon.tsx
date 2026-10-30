import { convertFileSrc } from "@tauri-apps/api/core";
import { cn } from "../lib/cn";
import { isImagePath } from "../lib/icon";

/** size-* 工具类 → emoji 字号，保证 emoji 与同尺寸图片图标视觉一致 */
const EMOJI_FONT_BY_SIZE: Record<string, string> = {
  "size-3.5": "14px",
  "size-4": "16px",
  "size-5": "20px",
  "size-6": "24px",
  "size-8": "32px",
  "size-10": "40px",
  "size-16": "64px",
};

interface ProjectIconProps {
  icon: string;
  className?: string;
}

/** 项目图标：自定义图片（data URL 直显，兼容旧路径）或 emoji */
export default function ProjectIcon({ icon, className }: ProjectIconProps) {
  if (isImagePath(icon)) {
    const src = icon.startsWith("data:") ? icon : convertFileSrc(icon);
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn("inline-block size-6 shrink-0 rounded object-cover", className)}
      />
    );
  }
  const sizeToken = className?.match(/(?:^|\s)(size-[\d.]+)/)?.[1];
  const fontSize = (sizeToken && EMOJI_FONT_BY_SIZE[sizeToken]) || "20px";
  return (
    <span
      className={cn("inline-flex items-center justify-center leading-none", className)}
      style={{ fontSize }}
    >
      {icon}
    </span>
  );
}
