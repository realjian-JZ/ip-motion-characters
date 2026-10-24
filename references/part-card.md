# 部件卡与拆分规则

给 imagegen 或矢量化步骤的，不是"提取左手"，而是一张部件卡。

```json
{
  "part_id": "arm_r",
  "parent": "torso",
  "motion_group": "arm_r",
  "z": "after:head",
  "pivot": [82, -186],
  "rotation_range": [-170, 40],
  "overlap_margin": "肩根向躯干内多画 12px，用卫衣色填满",
  "must_include": ["完整上臂轮廓", "肩根与躯干重叠部分"],
  "must_exclude": ["躯干", "帽绳", "前臂"],
  "occluded_by": [],
  "completion": ["被躯干挡住的肩根，按卫衣主色延伸"],
  "anchors": ["肩线中点", "肘部中心"],
  "variants": [],
  "secondary": "none"
}
```

| 字段 | 说明 |
|---|---|
| `pivot` | 旋转中心，父坐标系（脚底中心为原点，y 向上为负） |
| `rotation_range` | 动作会用到的最大角度；pose_test 按这个范围检查露缝 |
| `overlap_margin` | 关节处多画多少，保证转到极限不露缝 |
| `z` | 层级位置；**按遮挡关系定，不按运动分组定** |
| `variants` | 换形：口型、眉形、手势、转身轮廓（solo 切换） |
| `secondary` | `spring` / `lag` / `none` |

## 分层规则

1. **一起动的，不一定画在同一层。** 袖子跟手臂一起动，但大袖在身后、手和道具在身前，要拆成两层，挂同一个父级。
2. **前后成对的装饰拆两层。** 珠帘、披风、围巾：前排挂脸前/身前，后排藏在头后/身后。
3. **看得见的面没变，用骨骼带着形状动；面变了，整套换轮廓**（转身、侧身用 `variants` 切换，不硬扭）。
4. 手要能"换前后"：同一只手在身前、身后两种层级，各备一份。

## 命名（所有角色保持一致，动作模板才能通用）

```
shadow  root > body > leg_l, leg_r, torso
torso > strings_*/tie/... , head, arm_l > fore_l, arm_r > fore_r
head > hair_tuft, eyes > pupils, brow_l, brow_r, mouth(data-group)
```

`_l` / `_r` 指**画面左/右**。手臂旋转：`arm_l` 正角度向外抬，`arm_r` 负角度向外抬。

## 角色级声明（character.js）

| 字段 | 作用 | 例 |
|---|---|---|
| `upright: [part]` | 挂件抵消所有祖先旋转，始终下垂；再叠加弹簧摆动 | 老人的手提包 |
| `busyHand: 'r'` | 这只手拿着东西；单手手势模板自动左右镜像（`IPM.flip`） | 老人右手提包 |
| `swapAlias` | 用模板里的口型名，显示角色自己的形状 | 骗子 smile → smirk |
| `extras` | 角色专属动作，进 preview / render | 骗子 sneaky |
| `hair` | 惊吓时竖起的头发部件（默认 `hair_tuft`；`null` = 没有，如戴头盔、光头） | 骗子 `hair_lock` |
| `handX` | 手中心的 x（默认 84）：道具、V 字手指注入的位置 | 企鹅 98（鳍尖）、长颈鹿 74 |
| `starsY` | 晕眩星星环的高度（默认 −400） | 长颈鹿 −520（头在脖子上） |
| `height` | 身高（默认 372）：晕倒时按身高往右多挪，头不出画面 | 长颈鹿 480 |
| `chinReach: false` | 手够不到下巴：think 改为手搭胸前 | 长颈鹿 |
| `noFingers` | 没有手指（鳍、蹄）：不画 V 字手指，比耶变成举手在脸旁 | 企鹅、长颈鹿 |

动物角色可以加任意额外部件（`ear_l/r`、`tail`、`mane`、`horns`……），挂上弹簧即可；
必须保留的仍是上面那套人形部件名，所有动作模板才能通用。动物园系列由 `characters/_zoo_build.py` 从共享部件生成。

## 引擎注入的共享元素（不用画进角色 SVG）

| 名称 | 位置 | 类型 | 用法 |
|---|---|---|---|
| `prop_phone` | 空手前臂，手之前 | 换形组 off / on | phone_look |
| `gesture` | 空手前臂，手之后（盖在手上） | 换形组 none / peace | peace |
| `fx_heart` | 躯干最上层 | 部件 + 换形组 off / on | heart（用 sx / sy / y / o 做弹出、上飘、淡出） |
| `fx_stars` + `fx_star0..2` | 头部最上层 | 环（部件 + 换形组）+ 每颗星各自是部件 | faint（环匀速旋转；撞击时每颗星按抛物线飞出、落地） |
| `stage` | 包住影子和整个角色 | 部件 | 画面震动（addShake） |
| `fx_dust` + `fx_puff_l/r` | stage 内、角色前面的地面 | 部件 + 换形组 off / on | 落地扬尘（addDust：落点 x、大小） |

新增共享道具 / 手势 / 特效：在 `engine/ipm.js` 的 `PROPS` 或 `injectFX` 里加，所有角色自动获得。

## SVG 约定

- `data-part="id"`：受控部件；`data-pivot="x y"`：旋转中心。
- 换形：`<g data-group="mouth" data-swap="smile" data-default>`。
- 部件 `<g>` 上不要写 `transform`，引擎会覆盖；需要偏移就套一层不带 `data-part` 的 `<g>`。
