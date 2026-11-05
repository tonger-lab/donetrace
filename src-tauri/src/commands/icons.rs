//! 项目自定义图标命令：选择图片 + 缩放裁剪
//! 图标以 data URL 形式返回并存入数据库，渲染不依赖任何文件协议

use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropInput {
    /// 源图裁剪区域（图像像素坐标）
    pub sx: f64,
    pub sy: f64,
    pub sw: f64,
    pub sh: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IconPreview {
    /// 预览图 data URL（PNG，最长边 512px），可直接用于 <img>
    pub data_url: String,
    /// 原图尺寸（用于把预览坐标换算回原图坐标）
    pub width: u32,
    pub height: u32,
    /// 预览图实际尺寸（避免依赖前端 img onLoad）
    pub preview_width: u32,
    pub preview_height: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum IconError {
    #[error("读取图片失败: {0}")]
    Decode(String),
    #[error("裁剪区域无效")]
    InvalidCrop,
}

impl Serialize for IconError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

fn to_png_data_url(img: &image::DynamicImage) -> Result<String, IconError> {
    let mut buf: Vec<u8> = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| IconError::Decode(e.to_string()))?;
    use base64::Engine as _;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:image/png;base64,{b64}"))
}

/// 打开图片选择对话框，返回所选文件绝对路径（取消返回 null）
#[tauri::command]
pub fn pick_project_icon(app: tauri::AppHandle) -> Option<String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("图片", &["png", "jpg", "jpeg"])
        .blocking_pick_file();
    picked
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

/// 生成所选图片的预览 data URL（最长边 512px）与原始尺寸
#[tauri::command]
pub fn load_project_icon_preview(path: String) -> Result<IconPreview, IconError> {
    let img = image::open(&path).map_err(|e| IconError::Decode(e.to_string()))?;
    let (w, h) = (img.width(), img.height());
    let scale = 512.0 / (w.max(h) as f64);
    let pw = ((w as f64) * scale).round().max(1.0) as u32;
    let ph = ((h as f64) * scale).round().max(1.0) as u32;

    let preview = img.resize_exact(pw, ph, image::imageops::FilterType::Lanczos3);
    Ok(IconPreview {
        data_url: to_png_data_url(&preview)?,
        width: w,
        height: h,
        preview_width: pw,
        preview_height: ph,
    })
}

/// 按给定区域裁剪并缩放为 256x256，返回 PNG data URL（存入数据库）
#[tauri::command]
pub fn crop_project_icon(path: String, input: CropInput) -> Result<String, IconError> {
    if input.sw <= 0.0 || input.sh <= 0.0 {
        return Err(IconError::InvalidCrop);
    }
    let img = image::open(&path).map_err(|e| IconError::Decode(e.to_string()))?;
    let (w, h) = (img.width(), img.height());

    let sx = input.sx.max(0.0).min(w.saturating_sub(1) as f64) as u32;
    let sy = input.sy.max(0.0).min(h.saturating_sub(1) as f64) as u32;
    let sw = input.sw.min(w as f64 - sx as f64).max(1.0) as u32;
    let sh = input.sh.min(h as f64 - sy as f64).max(1.0) as u32;

    let cropped = img.crop_imm(sx, sy, sw, sh);
    let resized = cropped.resize_exact(256, 256, image::imageops::FilterType::Lanczos3);
    to_png_data_url(&resized)
}
