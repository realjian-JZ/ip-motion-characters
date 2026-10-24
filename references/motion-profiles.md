# 运动性格档案

角色"像不像这个人"，靠节奏，不靠造型。每个角色用 4 个维度描述，引擎 `IPM.derive()` 把它们换算成动作参数。

| 维度 | 0 → 1 | 影响 |
|---|---|---|
| `weight` 体重 | 轻 → 重 | 跳跃高度↓、落地挤压↑、整体略慢 |
| `energy` 能量 | 蔫 → 炸 | 动作快、幅度大、拉伸大、回弹多 |
| `stability` 稳定 | 抖 → 稳 | `<0.7` 开始加颤动（老人手抖、骗子心虚） |
| `style` 风格 | 枚举 | 主曲线和回稳曲线，见下表 |

## 换算（engine/ipm.js `derive`）

| 参数 | 公式 | 年轻人 (0.3/0.95) |
|---|---|---|
| `tempo` 时长倍率 | lerp(1.3, 0.8, e) × lerp(0.92, 1.2, w) | 0.83 |
| `amp` 幅度 | lerp(0.55, 1.2, e) | 1.17 |
| `jumpH` 跳高 px | lerp(40, 150, e) × lerp(1.1, 0.55, w) | 138 |
| `squash` 落地挤压 | lerp(0.07, 0.18, w) + 0.04e | 0.14 |
| `stretch` 腾空拉伸 | lerp(0.04, 0.12, e) | 0.116 |
| `lag` 跟随延迟 | lerp(2, 4, w) 帧 | 3 帧 |
| `tremble` 颤动度数 | (1 − s) × 2.2，> 0.3 才生效 | 0.22（不抖） |
| `armMax` 举手上限 | profile 覆盖，默认 132° | 132° |
| `tiptoe` 踮脚模式 | 原始 jumpH < 60 时为真 | 否 |
| `antic` 预备时长倍率 | 由 style 决定（下表） | 0.8 |

## style → 曲线

| style | main（主动作） | settle（回稳） | antic | idle 性格层 |
|---|---|---|---|---|
| `bouncy` | snap | bouncy | 0.8 | 原地踮两下；跳跃落地后补一个小回弹 |
| `steady` | ease | out | 1.0 | 不加——沉稳本身就是性格 |
| `sly` | sly | overshoot | 1.7 | 多一次反向瞟眼、重心跟眼神挪、单边挑眉 |
| `tired` | inout | out | 1.45 | 打瞌睡：眼皮下沉、头一点、猛然惊醒 |
| `slow` | inout | out | 1.5 | 更深更慢的呼吸（颤动来自 stability） |
| `waddle` | ease | bouncy | 1.1 | 站着也左右摇、偶尔拍鳍；走路是快而小的碎步 + 大幅左右摇（企鹅） |

## 反诈系列 5 个角色

| 角色 | id | weight | energy | stability | style | 其他 | 已实现专属动作 | 次级运动 |
|---|---|---|---|---|---|---|---|---|
| 年轻人 | `young` | 0.30 | 0.95 | 0.90 | bouncy | — | — | 呆毛、卫衣帽绳 |
| 上班族 | `worker` | 0.50 | 0.40 | 0.85 | tired | burst 0.85 · busyHand l | `yawn` | 领带、工牌、公文包、翘发 |
| 银行职员 | `teller` | 0.50 | 0.60 | 1.00 | steady | 手势换形 fist/palm | `alert` | 领巾两尾、侧发梢 |
| 骗子 | `scammer` | 0.40 | 0.75 | 0.70 | sly | swapAlias smile→smirk | `sneaky` | 油头刘海 |
| 老年人 | `elder` | 0.55 | 0.25 | 0.45 | slow | armMax 100 · busyHand r · 踮脚 | — | 手提包、地中海发丝 |

待做的招牌动作：年轻人刷手机/比耶、上班族看表/收到转账一愣、银行职员指屏幕、骗子递手机、老人眯眼凑近看手机/拍腿。

上班族的特殊点：常态 energy 0.4，但"高兴/惊讶"类动作临时用 0.85——**反差**就是他的性格。
在模板里用 `D.burst` 读取（未设置时等于 energy）。

## 动物园系列 5 个角色（v1.1）

| 角色 | id | weight | energy | stability | style | 其他 | 会晃的部位 |
|---|---|---|---|---|---|---|---|
| 熊猫 | `panda` | 0.75 | 0.45 | 0.95 | tired | burst 0.75 · armMax 110 · hair: ear_r | 圆耳朵 |
| 猴子 | `monkey` | 0.25 | 0.95 | 0.8 | bouncy | — | 卷尾巴（低阻尼）、耳朵、呆毛 |
| 长颈鹿 | `giraffe` | 0.5 | 0.55 | 1 | slow | height 480 · starsY −520 · handX 74 · chinReach false · noFingers · hair: horns | 小角、耳朵、尾巴 |
| 狮子 | `lion` | 0.6 | 0.7 | 1 | steady | burst 0.9 · hair: mane_tuft | 鬃毛（ss 果冻 + r 滞后）、鬃毛尖、尾巴 |
| 企鹅 | `penguin` | 0.45 | 0.6 | 0.9 | waddle | handX 98 · noFingers | 呆毛；鳍由前臂惯性自动带 |

剪影测试结果：走过 240px，猴子 1.9s · 狮子 3.1s · 企鹅 3.1s（碎步）· 熊猫 3.9s · 长颈鹿 4.2s；
企鹅起初用 slow，和熊猫、长颈鹿几乎同拍（3.9 / 4.0 / 4.2s），idle 活动帧 1% → 改为专属 waddle 后拉开，idle 26%。
