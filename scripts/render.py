"""Render character motions frame by frame through headless Chrome (CDP), then encode with ffmpeg.

    python scripts/render.py --char young --motion all
    python scripts/render.py --char young --motion happy_jump --fps 60

Output per motion in out/<char>/<motion>/: frames/*.png (transparent), <motion>.mp4, <motion>.gif, sheet.png
plus out/<char>/reel.mp4 with every motion back to back.
"""
import argparse
import asyncio
import base64
import contextlib
import functools
import glob
import http.server
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request

from websockets.asyncio.client import connect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = 600
SETTLE = 0.5  # seconds rendered past the end of one-shot motions
BG = "0xF6F1E7"
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]
SHOWREEL = ["idle", "happy_jump", "cheer", "sad", "think", "talk", "shock", "phone_look",
            "walk", "walk_across", "dance", "floss", "dab", "hero",
            "robot", "moonwalk", "peace", "heart", "faint", "beckon", "fever"]
LOOPS = {"idle", "talk", "walk", "dance", "floss", "robot", "sneaky", "beckon"}  # for --reel-only (a full render asks the page)


def serve(root):
    handler = functools.partial(QuietHandler, directory=root)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def find_chrome():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    found = shutil.which("chrome") or shutil.which("google-chrome") or shutil.which("msedge")
    if not found:
        raise SystemExit("Chrome/Edge not found")
    return found


class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.next_id = 0
        self.events = []

    async def call(self, method, **params):
        self.next_id += 1
        my_id = self.next_id
        await self.ws.send(json.dumps({"id": my_id, "method": method, "params": params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") == my_id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self.events.append(msg)

    async def wait_event(self, name, timeout=15):
        end = time.time() + timeout
        while time.time() < end:
            for i, ev in enumerate(self.events):
                if ev.get("method") == name:
                    return self.events.pop(i)
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            self.events.append(msg)
        raise TimeoutError(name)

    async def js(self, expr):
        res = await self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in res:
            raise RuntimeError(json.dumps(res["exceptionDetails"], ensure_ascii=False)[:600])
        return res["result"].get("value")


def ffmpeg(frames, fps, chain, out_args):
    """Pipe PNG frames in and the result out. Everything goes through stdin/stdout because inside
    sandboxed app folders ffmpeg may not see files that python just wrote."""
    cmd = ["ffmpeg", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "png", "-i", "-",
           "-f", "lavfi", "-i", f"color=c={BG}:s={SIZE}x{SIZE}:r={fps}",
           "-filter_complex", f"[1][0]overlay=shortest=1,{chain}", *out_args, "pipe:1"]
    return subprocess.run(cmd, input=b"".join(frames), stdout=subprocess.PIPE, check=True).stdout


def write(path, data):
    with open(path, "wb") as f:
        f.write(data)


def playback(frames, fps, loop):
    """Loops play 3 cycles, one-shots (already rendered with a settle tail) hold a quarter second."""
    return frames * 3 if loop else frames + [frames[-1]] * (fps // 4)


def encode(mdir, name, fps, frames, loop):
    seq = playback(frames, fps, loop)
    write(os.path.join(mdir, f"{name}.mp4"), ffmpeg(seq, fps, "format=yuv420p", MP4))
    write(os.path.join(mdir, f"{name}.gif"), ffmpeg(seq, fps, GIF, ["-f", "gif"]))
    # contact sheet: every 2nd frame (at 30fps), 10 per row, for QA
    step = max(1, round(fps / 15))
    rows = math.ceil(math.ceil(len(frames) / step) / 10)
    sheet = f"select='not(mod(n\\,{step}))',scale=160:160,tile=10x{rows}:padding=4:color=white"
    write(os.path.join(mdir, "sheet.png"), ffmpeg(frames, fps, sheet, ["-frames:v", "1", "-f", "image2pipe", "-c:v", "png"]))


MP4 = ["-c:v", "libx264", "-crf", "16", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4"]
GIF = "fps=30,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"


@contextlib.asynccontextmanager
async def open_page(page="render.html"):
    """Serve the skill folder, start headless Chrome, open `page`, yield a CDP session. Also used by lint.py."""
    httpd = serve(ROOT)
    port = httpd.server_address[1]
    profile_dir = tempfile.mkdtemp(prefix="ipm-chrome-")
    debug_port = 9333
    chrome = subprocess.Popen([
        find_chrome(), "--headless=new", f"--remote-debugging-port={debug_port}", f"--user-data-dir={profile_dir}",
        "--hide-scrollbars", "--force-device-scale-factor=1", f"--window-size={SIZE},{SIZE}",
        "--no-first-run", "--no-default-browser-check", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(100):
            try:
                targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{debug_port}/json/list", timeout=1))
                pages = [t for t in targets if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except OSError:
                pass
            time.sleep(0.1)
        if not ws_url:
            raise SystemExit("could not connect to Chrome")
        async with connect(ws_url, max_size=None) as ws:
            cdp = CDP(ws)
            await cdp.call("Page.enable")
            await cdp.call("Emulation.setDeviceMetricsOverride", width=SIZE, height=SIZE, deviceScaleFactor=1, mobile=False)
            await cdp.call("Emulation.setDefaultBackgroundColorOverride", color={"r": 0, "g": 0, "b": 0, "a": 0})
            await cdp.call("Page.navigate", url=f"http://127.0.0.1:{port}/{page}")
            await cdp.wait_event("Page.loadEventFired")
            yield cdp
    finally:
        chrome.terminate()
        try:
            chrome.wait(5)
        except subprocess.TimeoutExpired:
            chrome.kill()
        httpd.shutdown()
        shutil.rmtree(profile_dir, ignore_errors=True)


async def render(args):
    async with open_page() as cdp:
        extras = await cdp.js(f"__extras({json.dumps(args.char)})")
        motions = SHOWREEL + extras + ["idle@1", "idle@2", "tap@1", "tap@2", "tap@3", "tap@4", "pose_test"] if args.motion == "all" else args.motion.split(",")
        reel = []
        for name in motions:
            info = await cdp.js(f"__load({json.dumps(args.char)}, {json.dumps(name)})")
            dur, loop = info["duration"], info["loop"]
            # one-shots render a settle tail so springs (bags, ties, hair) come to rest on camera
            n = round(dur * args.fps) if loop else round((dur + SETTLE) * args.fps) + 1
            mdir = os.path.join(ROOT, "out", args.char, name)
            shutil.rmtree(mdir, ignore_errors=True)
            os.makedirs(os.path.join(mdir, "frames"))
            t0 = time.time()
            frames = []
            for i in range(n):
                await cdp.js(f"__seek({i / args.fps})")
                shot = await cdp.call("Page.captureScreenshot", format="png",
                                      clip={"x": 0, "y": 0, "width": SIZE, "height": SIZE, "scale": 1})
                frames.append(base64.b64decode(shot["data"]))
                write(os.path.join(mdir, "frames", f"f_{i:04d}.png"), frames[-1])
            encode(mdir, name, args.fps, frames, loop)
            print(f"{name:12s} {dur:5.2f}s  {n:4d} frames  {time.time() - t0:5.1f}s  -> out/{args.char}/{name}/")
            if name != "pose_test" and "@" not in name:
                reel += playback(frames, args.fps, loop)

        # only a full render rebuilds the reel; a partial run must not overwrite it with a subset
        if reel and args.motion == "all":
            write(os.path.join(ROOT, "out", args.char, "reel.mp4"), ffmpeg(reel, args.fps, "format=yuv420p", MP4))
            print(f"reel         -> out/{args.char}/reel.mp4")


def rebuild_reel(char, fps):
    """Re-encode out/<char>/reel.mp4 from frames already on disk (after re-rendering only a few motions)."""
    reel = []
    src = open(os.path.join(ROOT, "characters", char, "character.js"), encoding="utf-8").read()
    m = re.search(r"extras:\s*\[([^\]]*)\]", src)
    extras = re.findall(r"'([^']+)'", m.group(1)) if m else []
    for name in SHOWREEL + extras:
        fdir = os.path.join(ROOT, "out", char, name, "frames")
        files = sorted(glob.glob(os.path.join(fdir, "f_*.png")))
        if not files:
            print(f"skip {name}: no frames")
            continue
        frames = [open(f, "rb").read() for f in files]
        loop = name in LOOPS
        reel += playback(frames, fps, loop)
    write(os.path.join(ROOT, "out", char, "reel.mp4"), ffmpeg(reel, fps, "format=yuv420p", MP4))
    print(f"reel         -> out/{char}/reel.mp4")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--char", default="young")
    ap.add_argument("--motion", default="all", help="motion name, comma list, or 'all'")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--reel-only", action="store_true", help="rebuild reel.mp4 from existing frames, render nothing")
    a = ap.parse_args()
    if a.reel_only:
        rebuild_reel(a.char, a.fps)
    else:
        asyncio.run(render(a))
