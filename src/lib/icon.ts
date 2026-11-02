/** 判断 icon 值是自定义图片（data URL 或路径）还是 emoji */
export function isImagePath(icon: string): boolean {
  return (
    icon.startsWith("data:image/") ||
    /^[A-Za-z]:[\\/]/.test(icon) ||
    /^icons[\\/]/.test(icon) ||
    /\.(png|jpe?g)$/i.test(icon)
  );
}
