"""Build out/index.html: every character × motion gif, plus a per-motion row comparing all characters.

    python scripts/review.py
"""
import html
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
ORDER = ["idle", "happy_jump", "cheer", "sad", "think", "talk", "shock", "alert", "sneaky", "pose_test"]


def characters():
    chars = []
    for cid in sorted(os.listdir(os.path.join(ROOT, "characters"))):
        js = os.path.join(ROOT, "characters", cid, "character.js")
        if not os.path.exists(js):
            continue
        src = open(js, encoding="utf-8").read()
        name = re.search(r"name:\s*'([^']+)'", src)
        prof = re.search(r"profile:\s*(\{[^}]*\})", src)
        chars.append({"id": cid, "name": name.group(1) if name else cid, "profile": prof.group(1) if prof else ""})
    return chars


def motions(cid):
    d = os.path.join(OUT, cid)
    if not os.path.isdir(d):
        return []
    found = [m for m in os.listdir(d) if os.path.exists(os.path.join(d, m, f"{m}.gif"))]
    return sorted(found, key=lambda m: (ORDER.index(m) if m in ORDER else 99, m))


def version():
    log = open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read()
    m = re.search(r"^## (v[\d.]+[^\n]*)", log, re.M)
    return m.group(1) if m else "?"


def card(cid, m, label):
    gif = f"{cid}/{m}/{m}.gif"
    return (f'<figure><a href="{gif}"><img loading="lazy" src="{gif}" alt="{html.escape(label)}"></a>'
            f'<figcaption>{html.escape(label)} · <a href="{cid}/{m}/sheet.png">sheet</a> · '
            f'<a href="{cid}/{m}/{m}.mp4">mp4</a></figcaption></figure>')


def main():
    chars = [c for c in characters() if motions(c["id"])]
    by_char = []
    for c in chars:
        cards = "".join(card(c["id"], m, m) for m in motions(c["id"]))
        reel = f'<a href="{c["id"]}/reel.mp4">reel.mp4</a>' if os.path.exists(os.path.join(OUT, c["id"], "reel.mp4")) else ""
        by_char.append(f'<section><h2>{html.escape(c["name"])} <small>{c["id"]} · {html.escape(c["profile"])} · {reel}</small></h2>'
                       f'<div class="grid">{cards}</div></section>')
    all_motions = sorted({m for c in chars for m in motions(c["id"])}, key=lambda m: (ORDER.index(m) if m in ORDER else 99, m))
    by_motion = []
    for m in all_motions:
        cards = "".join(card(c["id"], m, c["name"]) for c in chars if m in motions(c["id"]))
        by_motion.append(f'<section><h2>{m}</h2><div class="grid">{cards}</div></section>')

    sil = sorted(f for f in os.listdir(os.path.join(OUT, "_compare")) if f.endswith(".png")) if os.path.isdir(os.path.join(OUT, "_compare")) else []
    sil_html = "".join(f'<figure class="wide"><a href="_compare/{f}"><img loading="lazy" src="_compare/{f}" alt="{f}"></a>'
                       f'<figcaption>{f[:-4]}</figcaption></figure>' for f in sil)
    by_motion.append(f'<section><h2>剪影对比 <small>只看动作能不能分出角色</small></h2>{sil_html}</section>' if sil else "")

    page = f"""<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>IP 动作总览</title>
<style>
:root {{ --bg:#F6F1E7; --panel:#fff; --ink:#2B2233; --muted:#8A8191; --line:#E8E1D4; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 system-ui,"PingFang SC","Microsoft YaHei",sans-serif; }}
header {{ padding:16px 20px; background:var(--panel); border-bottom:1px solid var(--line); position:sticky; top:0; z-index:1; }}
header h1 {{ margin:0; font-size:18px; }} header p {{ margin:4px 0 0; color:var(--muted); }}
nav a {{ margin-right:12px; color:var(--ink); }}
main {{ max-width:1200px; margin:0 auto; padding:0 16px 40px; }}
h2 {{ font-size:16px; margin:28px 0 10px; }} h2 small {{ color:var(--muted); font-weight:400; }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }}
figure {{ margin:0; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }}
figure img {{ width:100%; display:block; }} figure.wide {{ margin-bottom:10px; }}
figcaption {{ font-size:12px; padding:4px 8px; color:var(--muted); }} figcaption a {{ color:var(--muted); }}
.tab {{ display:none; scroll-margin-top:90px; }} .tab:target, .tab.default {{ display:block; }} :target ~ .default {{ display:none; }}
</style></head><body>
<header><h1>IP 动作总览 · {html.escape(version())}</h1>
<p>{len(chars)} 个角色 · <nav><a href="#by-char">按角色</a><a href="#by-motion">同一动作横向对比</a></nav></p></header>
<main>
<div id="by-motion" class="tab">{''.join(by_motion)}</div>
<div id="by-char" class="tab default">{''.join(by_char)}</div>
</main></body></html>"""
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(page)
    print(f"out/index.html  {len(chars)} characters, {len(all_motions)} motions")


if __name__ == "__main__":
    main()
