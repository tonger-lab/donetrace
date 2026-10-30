/** 项目自定义图标相关类型（与 Rust 端 commands/icons.rs 对齐） */
export interface IconPreview {
  /** 预览图 data URL（PNG，最长边 512px） */
  dataUrl: string;
  /** 原图尺寸（用于预览坐标 → 原图坐标换算） */
  width: number;
  height: number;
  /** 预览图实际尺寸 */
  previewWidth: number;
  previewHeight: number;
}
