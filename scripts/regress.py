"""Compare every out/*/*/sheet.png against the last commit, ignoring anti-aliasing noise.

    python scripts/regress.py            # vs HEAD
    python scripts/regress.py v0.5       # vs any commit / tag

A sheet counts as CHANGED when more than MIN_PIXELS pixels differ by more than TOLERANCE (0–255).
Byte-level `git status` is not enough: Chrome's anti-aliasing can shift edge pixels by a few levels between runs.
"""
import glob
import io
import os
import subprocess
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOLERANCE = 24
MIN_PIXELS = 40


def at_rev(rev, path):
    try:
        return subprocess.run(["git", "show", f"{rev}:{path}"], cwd=ROOT, capture_output=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None


def main():
    rev = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    changed, new = [], []
    for path in sorted(glob.glob(os.path.join(ROOT, "out", "*", "*", "sheet.png"))):
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        old = at_rev(rev, rel)
        if old is None:
            new.append(rel)
            continue
        a = Image.open(io.BytesIO(old)).convert("RGB")
        b = Image.open(path).convert("RGB")
        if a.size != b.size:
            changed.append((rel, f"size {a.size} -> {b.size}"))
            continue
        diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > TOLERANCE else 0)
        n = diff.histogram()[255]
        if n > MIN_PIXELS:
            changed.append((rel, f"{n} px"))
    for rel, why in changed:
        print(f"CHANGED  {rel}  ({why})")
    for rel in new:
        print(f"NEW      {rel}")
    if not changed and not new:
        print(f"no visual changes vs {rev}")


if __name__ == "__main__":
    main()
