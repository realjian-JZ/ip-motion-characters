"""Package the skill for sharing: a clean GitHub-ready repository + a zip.

    python scripts/showcase.py          # first: README images in docs/
    python scripts/package.py --repo-url https://github.com/<you>/ip-motion-characters --author "<你的名字>"

dist/ip-motion-characters/       the repository (SKILL.md at the root, so cloning it into a skills folder just works)
dist/ip-motion-characters.zip    the same folder zipped (Claude.ai skill upload / 网盘)

Copies a whitelist only: renders (out/), loop logs and local config stay behind.
"""
import argparse
import datetime
import os
import shutil
import stat
import subprocess
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = "ip-motion-characters"
INCLUDE = ["SKILL.md", "CHANGELOG.md", "requirements.txt", "preview.html", "render.html",
           "references", "engine", "characters", "cues", "scripts", "docs"]
SKIP_DIRS = {"__pycache__"}

GITIGNORE = """out/
dist/
__pycache__/
*.pyc
"""

LICENSE = """MIT License

Copyright (c) {year} {author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

README = """# IP Motion Characters · 会动的 IP 角色

一个 [Claude Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)：用一句话描述角色，让 AI 做出**灵动、Q 弹、有冲击力**的角色动画，
并且每一步都有确认关口和自动质检。

![角色](docs/lineup.png)

<p>
<img src="docs/scene.gif" width="320" alt="走进来、跳舞、dab、走出去">
<img src="docs/faint.gif" width="320" alt="晕倒：果冻落地、星星散落、眉毛撞歪">
</p>

![动作合集](docs/moves.gif)

## 它能做什么

- **31 个动作开箱即用**：idle、跳跃、欢呼、难过、思考、说话、惊吓、看手机、走路、走过画面、派对舞、甩胯舞、机器人舞、太空步、dab、叉腰、比耶、比心、晕倒……
- **性格决定节奏**：每个角色一份「运动性格档案」（体重 / 能量 / 稳定性 / 风格）。同一个动作模板，年轻人蹦着走，老人慢慢挪，骗子蹑手蹑脚。
- **冲击有连锁反应**：撞击定格、果冻回弹、头晚一拍、松脱物飞散、表情撞歪、扬尘、画面震动。
- **自动次级运动**：头发、领带、包的弹簧；前臂惯性；挂件保持下垂；身体与头的果冻层。
- **一句话串成片**：`seq@walk_across+dance_x2+dab+walk_across@l`，接缝自动过渡，位置自动衔接。
- **口型驱动**：读 [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) 的输出，自动加重音点头、停顿眨眼。
- **质量护栏**：`lint`（动画硬规则数值检查）、剪影对比（只看动作能否分出角色）、视觉回归（防止改坏旧动作）。

自带 5 个示例角色（反诈系列：年轻人、骗子、老年人、上班族、银行职员），可以照着做自己的系列。

## 安装

**Claude Code**

```bash
git clone {repo} ~/.claude/skills/{name}
```

**Claude.ai**：在仓库页点 Code → Download ZIP 下载，在 设置 → 功能 → Skills 上传。

**环境**：Python 3.9+、Google Chrome 或 Edge、ffmpeg（在 PATH 上）、git。

```bash
pip install -r requirements.txt
```

## 用法

对 Claude 说：

- 「做一个会动的外卖小哥，性格急躁，招牌动作是看表和小跑」
- 「让骗子走进来，跳一段舞，然后晕倒」
- 「给老年人加一个拍大腿恍然大悟的动作」

Claude 会按 `SKILL.md` 的流程走：角色卡 → 概念图（**关口 1：你确认造型**）→ 部件拆分 → 动作 → lint → 渲染 → 自检（**关口 2：你确认节奏**）→ 导出 → 把这次的修正写回 skill。

手动运行（在复制出来的工作目录里）：

```bash
python -m http.server 8765                         # 打开 http://localhost:8765/preview.html 交互预览
python scripts/lint.py                             # 硬规则检查
python scripts/render.py --char young --motion all # 渲染 → out/young/
python scripts/review.py                           # 总览页 out/index.html
```

## 目录

```
SKILL.md          流程、确认关口、硬规则（Claude 读这个）
references/       造型规范、部件卡、运动性格档案、曲线与冲击 token、状态名、口型、质检清单
engine/           ipm.js 引擎 · motions.js 动作模板 · lint.js
characters/       5 个示例角色（SVG 部件 + 性格档案）
scripts/          render · lint · regress · silhouette · review · showcase · package
CHANGELOG.md      每条规则从哪个问题来、怎么验证
```

## 说明

- 动画规律受多邻国式角色动画启发；**角色、造型和代码均为原创，与多邻国（Duolingo）无关**。
- 示例角色是几何 SVG，正式项目建议先用生图工具出概念图、确认后再拆部件（流程见 SKILL.md）。

## License

MIT
"""


def copy_tree(src, dst):
    if os.path.isdir(src):
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns(*SKIP_DIRS, "*.pyc"))
    elif os.path.exists(src):
        shutil.copy2(src, dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-url", default=f"https://github.com/<你的用户名>/{NAME}")
    ap.add_argument("--author", default="<作者>")
    a = ap.parse_args()

    dist = os.path.join(ROOT, "dist")
    repo = os.path.join(dist, NAME)
    if os.path.exists(repo):
        # .git objects are read-only on Windows: clear the flag and retry
        shutil.rmtree(repo, onerror=lambda fn, path, _: (os.chmod(path, stat.S_IWRITE), fn(path)))
    os.makedirs(repo)
    for item in INCLUDE:
        copy_tree(os.path.join(ROOT, item), os.path.join(repo, item))
    open(os.path.join(repo, "README.md"), "w", encoding="utf-8").write(README.format(repo=a.repo_url, name=NAME))
    open(os.path.join(repo, "LICENSE"), "w", encoding="utf-8").write(LICENSE.format(year=datetime.date.today().year, author=a.author))
    open(os.path.join(repo, ".gitignore"), "w", encoding="utf-8").write(GITIGNORE)

    # a fresh one-commit history, ready to push
    def git(*args):
        subprocess.run(["git", *args], cwd=repo, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    git("init", "-q", "-b", "main")
    git("config", "core.longpaths", "true")
    git("config", "core.autocrlf", "false")
    git("add", "-A")
    git("-c", "user.name=ip-motion-characters", "-c", "user.email=noreply@example.com", "commit", "-qm", "Initial release")

    zpath = os.path.join(dist, f"{NAME}.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for base, dirs, files in os.walk(repo):
            dirs[:] = [d for d in dirs if d != ".git"]
            for f in files:
                full = os.path.join(base, f)
                z.write(full, os.path.join(NAME, os.path.relpath(full, repo)))
    size = sum(os.path.getsize(os.path.join(b, f)) for b, ds, fs in os.walk(repo) if ".git" not in b for f in fs)
    print(f"dist/{NAME}/  ({size / 1e6:.1f} MB, git: 1 commit on main)")
    print(f"dist/{NAME}.zip  ({os.path.getsize(zpath) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
