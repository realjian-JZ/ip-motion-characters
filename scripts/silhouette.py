"""Silhouette test: can you tell the characters apart by movement alone?

    python scripts/silhouette.py happy_jump            # all rendered characters
    python scripts/silhouette.py shock --step 0.1

Writes out/_compare/<motion>_silhouette.png: one row per character, black silhouettes on a shared
time axis (every --step seconds), so timing and amplitude differences line up column by column.
Also prints per-character metrics read from the frames:
  dur   clip length            peak  highest lift of the top of the head (px)
  t_pk  time of that peak      spread widest silhouette (px)          act  share of frames that move
"""
import argparse
import glob
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL = 120


def load(char, motion):
    files = sorted(glob.glob(os.path.join(ROOT, "out", char, motion, "frames", "f_*.png")))
    return [Image.open(f).getchannel("A") for f in files]


def metrics(alphas, fps):
    tops, widths, moving = [], [], 0
    prev = None
    for a in alphas:
        box = a.point(lambda v: 255 if v > 40 else 0).getbbox()
        tops.append(box[1] if box else 0)
        widths.append(box[2] - box[0] if box else 0)
        small = a.resize((75, 75))
        if prev is not None and sum(abs(x - y) > 30 for x, y in zip(small.getdata(), prev.getdata())) > 8:
            moving += 1
        prev = small
    rest = tops[0]
    lift = [rest - t for t in tops]
    pk = max(range(len(lift)), key=lambda i: lift[i])
    return {"dur": len(alphas) / fps, "peak": lift[pk], "t_pk": pk / fps, "spread": max(widths),
            "act": moving / max(1, len(alphas) - 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("motion")
    ap.add_argument("--step", type=float, default=0.1)
    ap.add_argument("--fps", type=int, default=30)
    args = ap.parse_args()

    chars = [os.path.basename(d) for d in sorted(glob.glob(os.path.join(ROOT, "out", "*")))
             if os.path.isdir(os.path.join(d, args.motion, "frames"))]
    rows = {c: load(c, args.motion) for c in chars}
    longest = max(len(v) for v in rows.values()) / args.fps
    cols = int(longest / args.step) + 1
    sheet = Image.new("RGB", (90 + cols * CELL, len(chars) * CELL), "white")
    draw = ImageDraw.Draw(sheet)
    print(f"{args.motion}: {'char':10s} {'dur':>5s} {'peak':>5s} {'t_pk':>5s} {'spread':>6s} {'act':>5s}")
    for r, c in enumerate(chars):
        frames = rows[c]
        m = metrics(frames, args.fps)
        print(f"{'':{len(args.motion) + 2}s}{c:10s} {m['dur']:5.2f} {m['peak']:5d} {m['t_pk']:5.2f} {m['spread']:6d} {m['act']:5.0%}")
        draw.text((6, r * CELL + CELL // 2 - 6), c, fill="black")
        for k in range(cols):
            i = round(k * args.step * args.fps)
            if i >= len(frames):
                break
            sil = Image.new("L", frames[i].size, 255)
            sil.paste(0, mask=frames[i].point(lambda v: 255 if v > 40 else 0))
            sheet.paste(sil.convert("RGB").resize((CELL, CELL)), (90 + k * CELL, r * CELL))
        draw.line([(0, (r + 1) * CELL - 1), (sheet.width, (r + 1) * CELL - 1)], fill="#ddd")
    for k in range(cols):
        draw.text((90 + k * CELL + 4, 2), f"{k * args.step:.1f}s", fill="#999")
    os.makedirs(os.path.join(ROOT, "out", "_compare"), exist_ok=True)
    path = os.path.join(ROOT, "out", "_compare", f"{args.motion}_silhouette.png")
    sheet.save(path)
    print(f"-> out/_compare/{args.motion}_silhouette.png")


if __name__ == "__main__":
    main()
