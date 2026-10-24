"""Key-frame contact sheet for QA: rows = motions, columns = characters, a few moments per clip.

    python scripts/keyframes.py --chars panda,monkey,giraffe,lion,penguin --motions dance,dab,faint
    python scripts/keyframes.py --chars panda,lion --motions all --at 0.25,0.5,0.75

Writes out/_compare/keyframes_<tag>.png (one sheet per 8 motions). Frames are picked at fractions of each clip.
"""
import argparse
import glob
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
CELL = 150


def font(size):
    for p in ("C:/Windows/Fonts/msyh.ttc", "/System/Library/Fonts/PingFang.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chars", required=True)
    ap.add_argument("--motions", default="all")
    ap.add_argument("--at", default="0.35,0.6", help="fractions of each clip to sample")
    ap.add_argument("--tag", default=None)
    a = ap.parse_args()
    chars = a.chars.split(",")
    at = [float(x) for x in a.at.split(",")]
    if a.motions == "all":
        found = sorted({os.path.basename(d) for c in chars for d in glob.glob(os.path.join(OUT, c, "*")) if os.path.isdir(os.path.join(d, "frames"))})
        motions = [m for m in found if not m.startswith("seq@")]
    else:
        motions = a.motions.split(",")
    tag = a.tag or (a.motions if a.motions != "all" else "all").replace(",", "_")[:40]
    f = font(18)
    for page in range(0, len(motions), 8):
        ms = motions[page:page + 8]
        W = 110 + len(chars) * len(at) * CELL
        H = 30 + len(ms) * CELL
        sheet = Image.new("RGB", (W, H), "#F6F1E7")
        d = ImageDraw.Draw(sheet)
        for ci, c in enumerate(chars):
            d.text((110 + ci * len(at) * CELL + 6, 4), c, font=f, fill="#2B2233")
        for mi, m in enumerate(ms):
            y = 30 + mi * CELL
            d.text((6, y + CELL // 2 - 10), m, font=f, fill="#2B2233")
            for ci, c in enumerate(chars):
                files = sorted(glob.glob(os.path.join(OUT, c, m, "frames", "f_*.png")))
                for ai, fr in enumerate(at):
                    x = 110 + (ci * len(at) + ai) * CELL
                    if not files:
                        d.text((x + 40, y + 60), "—", font=f, fill="#999")
                        continue
                    im = Image.open(files[min(len(files) - 1, int(fr * len(files)))]).convert("RGBA").resize((CELL, CELL))
                    sheet.paste(im, (x, y), im)
            d.line([(0, y + CELL - 1), (W, y + CELL - 1)], fill="#E0D8CA")
        os.makedirs(os.path.join(OUT, "_compare"), exist_ok=True)
        path = os.path.join(OUT, "_compare", f"keyframes_{tag}_{page // 8 + 1}.png")
        sheet.save(path)
        print(os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
