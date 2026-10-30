"""生成成迹 DoneTrace 应用图标（仅 Pillow，无其他依赖）。

用法: python scripts/gen_icons.py
输出: src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.png,icon.ico}
"""

import os

from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "src-tauri", "icons")
SIZE = 1024


def make_master() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 蓝 → 靛蓝 渐变背景
    steps = 64
    band = SIZE // steps
    for i in range(steps):
        t = i / (steps - 1)
        r = int(37 + (79 - 37) * t)
        g = int(99 + (70 - 99) * t)
        b = int(235 + (229 - 235) * t)
        d.rectangle([0, i * band, SIZE, (i + 1) * band + 1], fill=(r, g, b, 255))

    # 圆角遮罩
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, SIZE - 1, SIZE - 1], radius=SIZE // 5, fill=255
    )
    img.putalpha(mask)

    # 白色对勾（完成）
    lw = SIZE // 12
    d = ImageDraw.Draw(img)
    d.line([(280, 560), (460, 720), (760, 340)], fill=(255, 255, 255, 255), width=lw, joint="curve")
    # 对勾两端圆头
    for x, y in [(280, 560), (760, 340)]:
        d.ellipse([x - lw // 2, y - lw // 2, x + lw // 2, y + lw // 2], fill=(255, 255, 255, 255))

    return img


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    master = make_master()

    for name, size in [
        ("32x32.png", 32),
        ("128x128.png", 128),
        ("128x128@2x.png", 256),
        ("icon.png", 512),
    ]:
        master.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))

    master.save(
        os.path.join(OUT, "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
