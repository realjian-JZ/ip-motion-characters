---
name: ip-motion-characters
description: 制作「会动的 IP 角色」系列（灵动、Q 弹、有冲击力，受多邻国式角色动画启发）：角色设定 → 概念图 → 部件拆分 SVG → 运动性格档案 → 参数化动作（走路、舞蹈、趣味姿势、情绪、口型）→ 渲染 mp4/gif，含动作串联、lint、剪影对比与视觉回归。用于"做一个会动的角色""给角色加动作/表情/舞蹈""批量做系列角色动画""让角色说这段台词""把几个动作串成一段"等。
---

# IP 动画角色制作

## 开工前

- **本 skill 是模板，不要直接在 skill 目录里改。** 先复制成工作目录：`cp -r <本 skill 目录> ./<项目名>`，之后所有命令在工作目录里跑。
- 环境：Python 3.9+（`pip install -r requirements.txt`）、Google Chrome 或 Edge（无头渲染）、ffmpeg（在 PATH 上）、git（regress 用）。
- 自带两套示例：反诈系列（年轻人、骗子、老年人、上班族、银行职员）和动物园系列（熊猫、猴子、长颈鹿、狮子、企鹅，由 `characters/_zoo_build.py` 生成）。做新系列时照着改，用不到的从 `characters/index.js` 移除。

一个角色 = `characters/<id>/`（SVG 部件 + 档案 + 弹簧）。动作不按角色手写，而是
`engine/motions.js` 里的**参数化模板 × 角色运动性格档案**：同一个"跳"在每个角色身上节奏不同，但同属一家。
引擎在所有动作上自动叠加：弹簧次级运动（头发、领带、包）、前臂惯性、挂件保持下垂、影子随高度变化、不稳角色的颤动；
共享道具（手机）与手势（V 字手指）注入空着的那只手；特效（爱心 fx_heart、晕眩星星 fx_stars）注入躯干 / 头部。

## 必须遵守的制作顺序

1. **角色卡**：身份、年龄、性格 → 运动性格档案（weight / energy / stability / style，可选 burst、armMax）
   + 招牌动作 + 次级运动部件 + 是否有手拿东西（busyHand）。见 `references/motion-profiles.md`。
2. **概念图**：imagegen 出 2–4 版（遵守 `references/style-principles.md`），或直接画几何 SVG。
   **【关口 1】用户确认具体版本。没有确认就停在这一步，不得自动选择、默认同意或提前拆部件。**
3. **部件拆分**：每个部件先写部件卡（`references/part-card.md`），再产出 `character.svg`。
   拆完立刻渲染 `--motion pose_test`，检查极限角度下的露缝和层级。
4. **动作**：先用现有模板 + 档案参数；模板表达不了的，才在 `motions.js` 加新模板（参数化，别写死数值；
   单手手势用 `freeHand()` 包一层）。时间、曲线、挤压数值遵守 `references/motion-tokens.md`。
5. **lint + 渲染 + 自检**：先 `python scripts/lint.py`（0 error 才渲染），再 `python scripts/render.py --char <id> --motion all`，按 `references/qa-checklist.md` 看 sheet；
   `python scripts/silhouette.py <motion>` 看剪影能否分出角色。
   **【关口 2】用户看 gif 确认动作。节奏问题在这里改，不要等到成片。**
6. **导出**：`out/<id>/<motion>/` 下的 mp4 / gif / 透明 PNG 序列，`out/<id>/reel.mp4` 合集，`out/index.html` 总览。
7. **回写 skill + 回归**：本轮聊天里的每次修正写进对应 reference，`CHANGELOG.md` 记一条（来源 · 症状 · 规则 · 验证）。
   改了引擎或模板 → 所有角色重渲染 → `python scripts/regress.py`，只允许预期内的 CHANGED。

## 硬规则（违反即返工）

- 禁止线性插值。例外只有两个：root.x 的匀速位移（走路、太空步）和 `fx_*` 特效的匀速旋转。上升用 `out`、下落用 `in`——重力感全靠这一条。
- 每个动作 = 预备 → 主动作 → 跟随 → 回稳。离地前必须蓄力，落地必须挤压；预备时长随风格变（`antic`）。
- 跟随：头、手臂比身体晚 `D.lag`（2–4 帧）；头发、领带、包交给弹簧；前臂惯性由引擎自动加。
- 挤压拉伸用 `ss`（面积守恒），pivot 在脚底。
- **一起动的，不一定画在同一层**：按遮挡关系分层（见 part-card）。
- 关节处多画重叠区；大头角色举手 ≤ `armMax`（默认 132°），否则挡脸。
- 手里有东西的角色声明 `busyHand`；挂件声明 `upright`。
- 重复的强调动作幅度 ≤ 6°，否则读成挥手。
- 循环动作首尾相等；一次性动作自带入场 → 保持 → 回中。
- 同一动作 5 个角色不能同拍（剪影测试 t_pk 要拉开）；idle 必须带性格层。
- 撞击是一串连锁反应：撞击定格 2 帧 → 果冻回弹（逐次减半）→ 部位错拍（头晚一拍）→ 松脱物飞散 → 表情撞歪 → 扬尘；最重的才加画面震动（见 motion-tokens「冲击与 Q 弹」）。
- 倒地 / 躺下时，压在下面的手脚只能往上弹，任何部件不能穿进地面；影子跟着铺开。

## 文件

```
SKILL.md                     流程与确认关口（本文件）
CHANGELOG.md                 每条规则的来源、症状、验证
references/
  style-principles.md        造型规范与系列配色
  part-card.md               部件卡 schema、分层、pivot、角色级声明（upright / busyHand / swapAlias / extras）
  motion-profiles.md         运动性格档案与 5 个角色设定
  motion-tokens.md           曲线 token、跳跃分段、数值范围、弹簧参数、引擎自动层
  state-machine.md           统一状态名
  lipsync.md                 Rhubarb 口型映射、时序规则、speak@ 用法
  qa-checklist.md            质检清单
engine/ipm.js                引擎：部件 + 关键帧 + 弹簧 + 自动层，seek(t) 确定性
engine/motions.js            参数化动作模板
characters/index.js          角色清单（唯一需要登记新角色的地方）
characters/<id>/             character.svg + character.js
cues/*.json → cues/cues.js   口型数据（scripts/cues2js.py 生成）
preview.html                 交互预览（慢放、拖时间轴、看 pivot）
render.html                  无头渲染页
scripts/render.py            Chrome 无头逐帧渲染 → mp4 / gif / sheet / reel
scripts/review.py            生成 out/index.html 总览
scripts/silhouette.py        剪影对比 + 节奏指标
scripts/keyframes.py         关键帧对照表：多角色 × 多动作（新系列 QA 用）
scripts/regress.py           带阈值的视觉回归（对比上一次提交）
scripts/lint.py              渲染前的硬规则数值检查（engine/lint.js）
scripts/cues2js.py           Rhubarb JSON → cues.js
scripts/package.py           打包成 GitHub 仓库 + zip（dist/）
requirements.txt             Python 依赖（websockets、Pillow）
```

## 动作清单

| 动作 | 说明 |
|---|---|
| `idle` / `idle@N` | 循环；带性格层；`@N` 为种子变体 |
| `happy_jump` · `cheer` · `shock` | 一次性；用 burst 能量；低能量角色自动改踮脚 |
| `sad` · `think` · `talk` | 一次性 / 循环 |
| `phone_look` | 掏出共享道具手机：刷屏 / 凑近眯眼 / 递出去 / 看完抬头，随 style 自动选 |
| `walk` · `walk_across[@l]` | 原地走（循环）/ 从画面一侧走到另一侧（±120px）；步态随 style：蹦着走、高抬腿潜行、拖步、慢挪、端正 |
| `dance` · `floss` | 120 BPM 派对律动（踩拍下沉 + 左右轮流挥拳）/ 甩胯舞（双臂左右甩、胯反向） |
| `dab` · `hero` | 趣味姿势：脸埋手肘 + 另一臂斜指 / 蹲一下弹起叉腰挺胸 |
| `robot` · `moonwalk[@r]` | 机器人舞（8 拍卡点定格，身体僵直）/ 太空步（无起伏匀速滑过画面，结尾踮脚甩手） |
| `peace` · `heart` · `faint` | 比耶（耳边 V 字）/ 比心（胸前爆出爱心、跳一下、上飘淡出）/ 晕倒（转圈星星 → 直挺挺倒地 → 弹起甩头） |
| `speak@<cue>` | 由 Rhubarb 口型数据驱动的说话 |
| `sneaky`（骗子）· `yawn`（上班族）· `alert`（银行职员） | 角色专属，登记在 `extras` |
| `seq@a+b+c` | 串联成一条片子：`seq@walk_across+dance_x2+dab+walk_across@l`；循环动作用 `_xN` 重复；接缝自动过渡 0.15–0.4s；位置自动衔接（在走到的地方接着演） |
| `pose_test` | 质检用：极限姿势 |

## 运行

```bash
python -m http.server 8765                              # 在本目录，打开 http://localhost:8765/preview.html
python scripts/render.py --char young --motion all       # 单个角色全部动作
python scripts/render.py --char teller --motion speak@sample
python scripts/render.py --char young --reel-only          # 只重渲了几个动作后，用现有帧重拼合集
python scripts/lint.py
python scripts/review.py && python scripts/regress.py
python scripts/silhouette.py happy_jump
```

## 扩展

- **新动作**：在 `engine/motions.js` 写 `M.<name> = (D, def, arg) => ({ duration, loop, tracks, swaps })`，用 `T()`、`D.settle`、`D.lag` 等档案参数；
  有落地就 `addDust`，最重的撞击 `addShake`；单手手势 `freeHand(m, 'r', def)`；然后加进 `scripts/render.py` 的 SHOWREEL、`preview.html` 的 BASE、`engine/lint.js` 的检查清单。
- **新共享道具 / 手势 / 特效**：在 `engine/ipm.js` 的 `PROPS` 或 `injectFX` 里加一次，所有角色自动获得（见 part-card「引擎注入的共享元素」）。

## 新角色 checklist

1. 复制最接近的 `characters/<id>/`，改 `character.svg` 造型；part 命名保持一致（见 part-card）。
2. 改 `character.js`：`IPM.register(id, { name, svg, profile, springs, upright?, busyHand?, swapAlias?, extras? })`。
3. 在 `characters/index.js` 的列表里加上 id。
4. 渲染 `pose_test` → 关口 1 → `--motion all` → 剪影对比 → 关口 2 → review + regress → CHANGELOG。
