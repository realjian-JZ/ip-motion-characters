"""Build showcase assets from rendered frames (run after `render.py --motion all` for every character).

    python scripts/showcase.py                       # docs/ (README images) + dist/xiaohongshu/ (social kit)
    python scripts/showcase.py --repo-url https://github.com/<you>/ip-motion-characters

docs/: lineup.png, moves.gif (3×2 dance/pose grid), scene.gif, faint.gif
dist/xiaohongshu/: 01–06 carousel images (1080×1440, 3:4), showcase.mp4 (1080×1440, 12s), post.md (title, body, tags)
"""
import argparse
import glob
import os
import re
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
BG, INK, MUTED, ACCENT, CARD = "#F6F1E7", "#2B2233", "#8A8191", "#FF8A3D", "#FFFFFF"
W, H = 1080, 1440
FONT_PATHS = {
    "regular": ["C:/Windows/Fonts/msyh.ttc", "/System/Library/Fonts/PingFang.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"],
    "bold": ["C:/Windows/Fonts/msyhbd.ttc", "/System/Library/Fonts/PingFang.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"],
}
PERSONA = {
    "young": "蹦蹦跳跳，停不下来",
    "scammer": "油滑，眼神先动",
    "elder": "慢半拍，手会抖",
    "worker": "平时犯困，高兴就炸",
    "teller": "沉稳，收得住",
}


def font(size, weight="regular"):
    for p in FONT_PATHS[weight]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def characters():
    src = open(os.path.join(ROOT, "characters", "index.js"), encoding="utf-8").read()
    ids = re.findall(r"'([a-z_]+)'", re.search(r"CHARACTERS = \[([^\]]*)\]", src).group(1))
    out = []
    for cid in ids:
        js = open(os.path.join(ROOT, "characters", cid, "character.js"), encoding="utf-8").read()
        out.append((cid, re.search(r"name:\s*'([^']+)'", js).group(1)))
    return out


def frame(cid, motion, t=0.0):
    files = sorted(glob.glob(os.path.join(OUT, cid, motion, "frames", "f_*.png")))
    if not files:
        raise SystemExit(f"missing frames: out/{cid}/{motion} — render it first")
    return Image.open(files[min(len(files) - 1, round(t * 30))]).convert("RGBA")


def crop_char(im, box=(110, 130, 490, 580)):
    return im.crop(box)


def rounded(draw, xy, r, fill):
    draw.rounded_rectangle(xy, r, fill=fill)


def text_center(draw, cx, y, s, f, fill=INK):
    w = draw.textlength(s, font=f)
    draw.text((cx - w / 2, y), s, font=f, fill=fill)


def footer(draw, repo):
    text_center(draw, W / 2, H - 70, repo, font(28), MUTED)


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True, cwd=ROOT)


def clip_frames(cid, motion):
    """Transparent frames of a rendered motion; one-shots get a 0.4s hold so grids don't snap straight back."""
    files = sorted(glob.glob(os.path.join(OUT, cid, motion, "frames", "f_*.png")))
    if not files:
        raise SystemExit(f"missing frames: out/{cid}/{motion} — render it first")
    return files + [files[-1]] * 12


def grid_video(picks, cols, cell, size, seconds, fps, out_args, label_font=None, crop=None):
    """Compose a looping grid of clips frame by frame in PIL (labels in any font), pipe raw RGB to ffmpeg.
    Avoids ffmpeg's -stream_loop on fragmented mp4s and drawtext font problems."""
    clips = [clip_frames(c, m) for c, m, _ in picks]
    cache = {}
    cw, ch = cell
    n = int(seconds * fps)
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}",
           "-framerate", str(fps), "-i", "-", *out_args]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, cwd=ROOT)
    for i in range(n):
        frame_im = Image.new("RGB", size, BG)
        d = ImageDraw.Draw(frame_im)
        for k, ((cid, m, label), files) in enumerate(zip(picks, clips)):
            # source is 30fps: pick the frame for this output time, looping
            f = files[int(i * 30 / fps) % len(files)]
            if f not in cache:
                im = Image.open(f).convert("RGBA")
                if crop:
                    im = im.crop(crop)
                side = min(cw, ch - (48 if label else 0))
                cache[f] = im.resize((side, side))
            im = cache[f]
            x, y = (k % cols) * cw, (k // cols) * ch
            frame_im.paste(im, (x + (cw - im.width) // 2, y), im)
            if label and label_font:
                text_center(d, x + cw / 2, y + ch - 46, label, label_font)
        if len(cache) > 400:
            cache.clear()
        proc.stdin.write(frame_im.tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit("ffmpeg failed")


# ---------------------------------------------------------------- docs (README)
def build_docs(chars):
    docs = os.path.join(ROOT, "docs")
    os.makedirs(docs, exist_ok=True)
    # lineup
    cell = 300
    im = Image.new("RGB", (cell * len(chars), cell + 60), BG)
    d = ImageDraw.Draw(im)
    for i, (cid, name) in enumerate(chars):
        c = crop_char(frame(cid, "idle")).resize((cell, int(cell * 450 / 380)))
        c = c.crop((0, 0, cell, cell))
        im.paste(c, (i * cell, 0), c)
        text_center(d, i * cell + cell / 2, cell + 10, name, font(30, "bold"))
    im.save(os.path.join(docs, "lineup.png"))
    # 3×2 grid gif of dances / poses
    picks = [("young", "dance", None), ("scammer", "sneaky", None), ("teller", "robot", None),
             ("worker", "yawn", None), ("elder", "faint", None), ("young", "heart", None)]
    grid_video(picks, 3, (240, 240), (720, 480), 6, 12,
               ["-filter_complex", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "docs/moves.gif"])
    # scene + faint, downscaled
    scene = glob.glob(os.path.join(OUT, "young", "seq@walk_across+dance_x2+dab+walk_across@l", "*.mp4"))
    if scene:
        ffmpeg("-i", os.path.relpath(scene[0], ROOT), "-filter_complex",
               "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "docs/scene.gif")
    ffmpeg("-i", "out/young/faint/faint.mp4", "-filter_complex",
           "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "docs/faint.gif")
    print("docs/: lineup.png moves.gif scene.gif faint.gif")


# ---------------------------------------------------------------- xiaohongshu kit
def slide_cover(chars, repo):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    rounded(d, (80, 120, 470, 186), 33, ACCENT)
    text_center(d, 275, 128, "Claude Skill · 开源", font(34, "bold"), "#FFFFFF")
    d.text((80, 240), "让 AI 做出", font=font(108, "bold"), fill=INK)
    d.text((80, 380), "会动的角色", font=font(108, "bold"), fill=ACCENT)
    d.text((84, 540), "灵动 · Q弹 · 有冲击力　一个 Skill 搞定", font=font(40), fill=MUTED)
    # big, overlapping lineup filling the lower half
    cell = W // len(chars)
    size = cell + 150
    for i, (cid, _) in enumerate(chars):
        # jumping frames ride high: crop from the top of the canvas so heads aren't cut
        src = frame(cid, "happy_jump", 0.55) if cid != "elder" else frame(cid, "idle")
        c = src.crop((110, 0, 490, 590)).resize((size, int(size * 590 / 380)))
        im.paste(c, (i * cell - 75, 560), c)
    footer(d, repo)
    return im


def slide_cast(chars, repo):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    text_center(d, W / 2, 90, "5 个角色 · 5 种性格", font(72, "bold"))
    text_center(d, W / 2, 190, "同一套动作模板，按「运动性格档案」演出不同节奏", font(34), MUTED)
    top, ch = 280, 205
    for i, (cid, name) in enumerate(chars):
        y = top + i * (ch + 15)
        rounded(d, (70, y, W - 70, y + ch), 28, CARD)
        c = crop_char(frame(cid, "idle")).resize((190, 225)).crop((0, 0, 190, 200))
        im.paste(c, (100, y + 3), c)
        d.text((320, y + 45), name, font=font(52, "bold"), fill=INK)
        d.text((320, y + 120), PERSONA.get(cid, ""), font=font(36), fill=MUTED)
    footer(d, repo)
    return im


def slide_walk(chars, repo):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    text_center(d, W / 2, 90, "同一段路，5 种走法", font(72, "bold"))
    text_center(d, W / 2, 190, "走过 240px：步频、抬腿、摇摆全由性格决定", font(34), MUTED)
    times = []
    for cid, name in chars:
        n = len(glob.glob(os.path.join(OUT, cid, "walk_across", "frames", "f_*.png")))
        times.append(max(0.1, n / 30 - 0.35 - 0.5))
    tmax = max(times)
    top, ch = 280, 205
    for i, ((cid, name), t) in enumerate(zip(chars, times)):
        y = top + i * (ch + 15)
        rounded(d, (70, y, W - 70, y + ch), 28, CARD)
        c = crop_char(frame(cid, "walk", 0.2)).resize((190, 225)).crop((0, 0, 190, 200))
        im.paste(c, (100, y + 3), c)
        d.text((320, y + 40), name, font=font(44, "bold"), fill=INK)
        bw = int(560 * t / tmax)
        rounded(d, (320, y + 115, 320 + bw, y + 150), 17, ACCENT)
        d.text((330 + bw, y + 108), f" {t:.1f}s", font=font(36, "bold"), fill=INK)
    footer(d, repo)
    return im


def slide_moves(repo):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    text_center(d, W / 2, 90, "30+ 个动作，开箱即用", font(72, "bold"))
    text_center(d, W / 2, 190, "走路 · 舞蹈 · 趣味姿势 · 情绪 · 口型 · 串联成片", font(34), MUTED)
    picks = [("young", "dance", 0.15, "派对舞"), ("young", "floss", 0.0, "甩胯舞"), ("teller", "robot", 0.5, "机器人舞"),
             ("young", "moonwalk", 3.75, "太空步"), ("scammer", "dab", 0.7, "dab"), ("worker", "hero", 0.9, "叉腰"),
             ("young", "peace", 0.9, "比耶"), ("young", "heart", 0.8, "比心"), ("elder", "phone_look", 1.0, "看手机"),
             ("worker", "yawn", 1.0, "打哈欠"), ("scammer", "sneaky", 1.3, "搓手偷看"), ("young", "shock", 0.35, "吓一跳")]
    # 4 columns × 3 rows (3 × 4 ran into the footer)
    cw, chh, top = 222, 340, 270
    for k, (cid, m, t, label) in enumerate(picks):
        col, row = k % 4, k // 4
        x, y = 70 + col * (cw + 14), top + row * chh
        rounded(d, (x, y, x + cw, y + chh - 16), 24, CARD)
        c = frame(cid, m, t).crop((60, 110, 540, 590)).resize((210, 210))
        im.paste(c, (x + 6, y + 18), c)
        text_center(d, x + cw / 2, y + 252, label, font(32, "bold"))
    footer(d, repo)
    return im


def slide_impact(repo):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    text_center(d, W / 2, 90, "细节：撞击是一串连锁反应", font(66, "bold"))
    text_center(d, W / 2, 190, "倒地不是硬砸——压扁、回弹、星星散落、眉毛撞歪", font(34), MUTED)
    land = 1.83
    shots = [(land - 0.033, "① 倒下前：星星绕头转"), (land + 0.033, "② 撞击：压扁定格 2 帧 + 扬尘"),
             (land + 0.2, "③ 果冻回弹，头晚一拍拍地"), (land + 0.9, "④ 星星散落在地，眉毛歪了")]
    top = 270
    for i, (t, label) in enumerate(shots):
        y = top + i * 270
        rounded(d, (70, y, W - 70, y + 250), 28, CARD)
        c = frame("young", "faint", t).crop((0, 330, 600, 600)).resize((520, 234))
        im.paste(c, (90, y + 8), c)
        d.multiline_text((640, y + 80), label.replace("：", "：\n", 1).replace("，", "，\n", 1), font=font(34, "bold"), fill=INK, spacing=12)
    footer(d, repo)
    return im


def slide_howto(repo):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    text_center(d, W / 2, 90, "怎么用", font(72, "bold"))
    steps = [
        ("装上 Skill", "Claude Code：放进 ~/.claude/skills/\nClaude.ai：设置里上传 zip"),
        ("说一句话", "「做一个会动的外卖小哥，性格急躁」\n「让骗子走进来，跳舞，然后晕倒」"),
        ("两道确认关口", "① 造型定稿　② 看 gif 确认节奏\n不确认就不往下做"),
        ("自动质检", "lint 硬规则 · 剪影对比 · 视觉回归\n每次修正都写回 skill"),
        ("导出", "mp4 / gif / 透明 PNG 序列 / 合集"),
    ]
    top = 230
    for i, (h, body) in enumerate(steps):
        y = top + i * 215
        rounded(d, (70, y, W - 70, y + 195), 28, CARD)
        d.ellipse((100, y + 50, 190, y + 140), fill=ACCENT)
        text_center(d, 145, y + 62, str(i + 1), font(52, "bold"), "#FFFFFF")
        d.text((230, y + 30), h, font=font(44, "bold"), fill=INK)
        d.multiline_text((230, y + 95), body, font=font(32), fill=MUTED, spacing=10)
    footer(d, repo)
    return im


def build_video(kit):
    picks = [("young", "dance", "年轻人 · 派对舞"), ("scammer", "sneaky", "骗子 · 搓手偷看"), ("elder", "faint", "老年人 · 晕倒"),
             ("worker", "yawn", "上班族 · 打哈欠"), ("teller", "robot", "银行职员 · 机器人舞"), ("young", "moonwalk", "年轻人 · 太空步")]
    grid_video(picks, 2, (540, 480), (W, H), 12, 30,
               ["-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", os.path.relpath(os.path.join(kit, "showcase.mp4"), ROOT)],
               label_font=font(30, "bold"))


def build_kit(chars, repo):
    kit = os.path.join(ROOT, "dist", "xiaohongshu")
    shutil.rmtree(kit, ignore_errors=True)
    os.makedirs(kit)
    slides = [slide_cover(chars, repo), slide_cast(chars, repo), slide_walk(chars, repo), slide_moves(repo), slide_impact(repo), slide_howto(repo)]
    for i, im in enumerate(slides, 1):
        im.save(os.path.join(kit, f"{i:02d}.png"))
    build_video(kit)
    open(os.path.join(kit, "post.md"), "w", encoding="utf-8").write(POST.replace("{repo}", repo))
    print("dist/xiaohongshu/: 01–06.png showcase.mp4 post.md")


POST = """# 小红书笔记

## 标题（≤20 字，选一个）
- 我写了个 Skill，让 AI 做会动的角色
- 一句话让 AI 做出 Q 弹的角色动画
- 开源｜AI 角色动画 Skill，31 个动作

## 正文

做了一个 Claude Skill：一句话描述角色，AI 就能做出会动、有性格的角色动画 🎬

✨ 能做什么
· 5 个示例角色，31 个动作开箱即用：走路、派对舞、甩胯舞、机器人舞、太空步、比耶、比心、dab、晕倒……
· 同一个动作，不同性格演出不同节奏：年轻人蹦着走，老人慢慢挪，骗子蹑手蹑脚
· 撞击有连锁反应：倒地会压扁回弹、星星散落一地、眉毛被撞歪
· 一句话串成片：「走进来 → 跳舞 → dab → 走出去」

🔧 它怎么保证质量
· 两道确认关口：造型和节奏都要你点头才往下做
· 自动质检：lint 检查动画硬规则、剪影对比看性格是否分得出、视觉回归防止改坏旧动作
· 每次修正都会写回 skill，越用越准

📦 怎么用
Claude Code 放进 ~/.claude/skills/，或在 Claude.ai 设置里上传 zip
开源地址：{repo}（评论区置顶）

灵感来自多邻国式的角色动画规律；角色和代码均为原创，与多邻国无关。

## 话题标签
#AI动画 #Claude #AI工具 #角色设计 #动画制作 #开源项目 #AIGC #MG动画 #效率工具 #设计师日常

## 发布建议
- 图片顺序：01 封面 → 02 角色 → 03 走路对比 → 04 动作合集 → 05 撞击细节 → 06 怎么用
- 也可以发视频笔记：showcase.mp4（1080×1440，12 秒），封面用 01.png
- 小红书正文里的链接不能点，开源地址放在置顶评论或个人简介里
"""


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-url", default="github.com/<你的用户名>/ip-motion-characters")
    ap.add_argument("--only", choices=["docs", "kit"], default=None)
    a = ap.parse_args()
    cs = characters()
    if a.only != "kit":
        build_docs(cs)
    if a.only != "docs":
        build_kit(cs, a.repo_url)
