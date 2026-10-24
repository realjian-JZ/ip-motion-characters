# 口型

用 Rhubarb Lip Sync 从音频生成 JSON（`{"mouthCues":[{"start":0.35,"end":0.42,"value":"B"}]}`），映射到统一口型名。

| Rhubarb | 发音 | 口型名 |
|---|---|---|
| X | 静止 | `smile` 或 `flat`（看情绪） |
| A | M B P 闭嘴 | `flat` |
| B | 大部分辅音，微张露齿 | `wide` |
| C | EH 等，张开 | `open` |
| D | AA 大张 | `grin` |
| E | ER / O 圆 | `o` |
| F | OO / W 嘟嘴 | `u` |
| G | F V 咬唇 | `wide` |
| H | L 舌尖 | `open` |

## 时序规则
- 口型**提前 1–2 帧**出现（看到嘴先于听到声音才自然）。
- 短于 2 帧的口型合并进相邻口型，避免闪烁。
- 每句重音音节：头点一下（y −3 ~ −5，snap）+ 眉毛抬一下。只有嘴在动 = 不像在说话。
- 句末停顿 > 0.4 秒：回 `X`，并在停顿里补一次眨眼。

## 用法（已实现：`speak@<cue>` 模板）

```bash
rhubarb -f json -o cues/line01.json line01.wav   # 生成口型 cue（Rhubarb 需单独安装）
python scripts/cues2js.py                        # cues/*.json → cues/cues.js
python scripts/render.py --char teller --motion speak@line01
```

模板自动完成：口型提前 0.05s、短于 2 帧的 cue 合并、C/D 元音 ≥0.1s 且相隔 ≥0.4s 记为重音（点头 −4 + 抬眉 −6）、
≥0.4s 的停顿中间补一次眨眼、头部 0.8s 周期慢摆、第一个重音处空手做一个摊手手势（会避开 busyHand）。
`cues/sample.json` 是手写的测试 cue（「您好，这里是银行。请您先别转账，好吗？」），换成真实录音的输出即可。
渲染出的 mp4 没有声音：合成时用 ffmpeg 把 wav 混进去（`-i video.mp4 -i line01.wav -c:v copy -shortest`）。
