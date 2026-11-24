# APEX 猜选手 · 技术路线与数据方案

> 目标：南京师范大学电竞社 APEX 分部 · 百团招新现场用
> 形态：Wordle 式猜职业选手小游戏（对标 shnlfriberg.online「弗一把」）
> 交付：GitHub Pages 可部署的纯静态站点，现场零残留
> 周期：3 天，快速构建 + 测试修复
> 版本：v1 · 2026-11-23

---

## 0. 一句话结论

**做纯前端静态游戏，数据在构建期烘成 JSON 提交进仓库，运行时零网络请求、零 cookie、零本地存储。**
选手池手工人肉整理 50 人（国内为主），不写爬虫——因为国内 Apex 选手的公开数据源太碎，自动抓取的质量成本高于人工。

---

## 1. 参考站拆解

`shnlfriberg.online` 实际是「弗一把」（开源项目 `shnlfriberg/csgofriberg`，AGPL-3.0）：

| 维度 | 参考站做法 |
|---|---|
| 核心玩法 | 隐藏一名选手，逐次猜测，按属性返回绿/黄/灰 |
| 数据 | 646 名 CS Major 选手，独立仓库 `csgo-major-db` 的 `players.json` |
| 模式 | 每日一题 + 多人房（BO1/3/5/7）+ 观战 + 回放 + 排行榜 + 后台 |
| 技术 | React 18 + Express + Socket.IO + Redis + PostgreSQL/SQLite |

**关键判断：多人房、排行榜、后台都需要服务端。我们是静态站，这些全部砍掉。**
现场场景反而更适合"每人一局随机"——每日一题会让第二个玩家直接知道答案。

---

## 2. 产品定义

### 2.1 单人玩法（现场唯一主模式）

```
选难度 → 随机抽 1 名选手 → 最多 6 次猜测 → 逐属性绿/黄/灰反馈 → 猜中/用尽 → 结果卡 → 再来一局
```

- 同一页面会话内不重复出题（内存 Set），刷新即重置
- 无持久化：不写 cookie / localStorage / sessionStorage / IndexedDB / 缓存
- 结果卡可"复制战绩"到剪贴板（Wordle 式 emoji 方块），用户主动触发

### 2.2 反馈属性（6 项）

| 属性 | 绿（完全命中） | 黄（接近） |
|---|---|---|
| 地区 | 完全相同 | 同赛区（如大陆 / 港澳台） |
| 战队 | 相同 | 同赛区或已知转会关联 |
| 位置 | 相同 | 相近（突破 ↔ 自由人） |
| 标志性传奇 | 相同 | 同定位（突击 / 侦察 / 控制 / 支援） |
| 出道年份 | 相同 | ±2 年内，带 ↑↓ 箭头 |
| 最高荣誉 | 同档 | 相邻档（世界冠军 / 国际决赛 / 国内冠军 / 无） |

> 用「出道年份」而不是「年龄」：更好核实，也更少隐私问题。

### 2.3 难度三档

| 档位 | 池子 | 定位 |
|---|---|---|
| 简单 | 约 10 人 | 大赛冠军级，全国知名（ALGS 世界赛 / EWC / 星空杯） |
| 中等 | 约 20 人 | 一线职业 + 头部主播 |
| 困难 | 约 20 人 | 现役边缘 / 退役 / 教练 / 国际补充 |

总计 ≤ 50 人。每档独立抽题，可跨档混合（可选开关）。

---

## 3. 数据来源与合规（重点）

### 3.1 Liquipedia 到底会不会 ban

**会——如果你按错的方式用。**

| 通道 | 限制 | 说明 |
|---|---|---|
| MediaWiki API<br>`liquipedia.net/<game>/api.php` | **1 请求 / 2 秒**<br>`action=parse` **1 请求 / 30 秒** | 无需 key，但必须带可识别的 User-Agent（应用名 + 联系方式） |
| LiquipediaDB v3 API<br>`api.liquipedia.net/api/v3` | **60 请求 / 小时** | 需申请审批 + API key，header `Authorization: Apikey <key>` |
| 数据库整包下载 | **不存在** | 没有 Wikipedia 式的 XML dump，官方不提供 |

**三条硬规则：**

1. **绝不在浏览器端请求 Liquipedia。** 除了 ToS 风险，CORS 也不允许，技术上就走不通。
2. **只在构建期抓一次**，抓完烘成 JSON 提交进仓库，线上站点永不联网。
3. **批量拉取用多标题查询**：`action=query&prop=revisions&rvprop=content&titles=A|B|C...` 单次可达 50 个标题，50 名选手 ≈ 1~2 个请求，连限速都不会碰到。

一个 50 人规模的一次性抓取，按 2 秒间隔也就 2 分钟，**不会被 ban**。
现场几百人反复查询才会——而我们的架构根本不会发生这种事。

**授权**：Liquipedia 内容为 CC-BY-SA 3.0，非商业使用 + 署名。校园社团招新属非商业，页面底部加一行署名即可。

### 3.2 国内选手的数据现实

这是本方案最大的坑。实测搜索结果里，同一个人在不同来源对不上：

- `LqDud / 老吊` 的中文名出现「汪轶鹏」与「王一鹏」两种写法
- `Roieee` 有「百弟 / 陈柏瀚」两种称呼
- `Pite` 有「皮特 / Pite174」
- `3Mz` 有「三明治 / 王虎」

**结论：不写自动爬虫。50 人的规模，人工整理 + 多源交叉核对，质量更高、时间更省。**

### 3.3 数据来源分层

**先厘清一件事：选手「属性」和「赛事成绩」是两套数据，来源不同。**

- 属性（国家 / 队伍 / 位置 / 标志性传奇 / 出道年份）→ 百科类来源
- 成绩（冠军 / 名次 / 奖金）→ 赛事数据类来源

| 优先级 | 来源 | 覆盖什么 | 获取方式 | 备注 |
|---|---|---|---|---|
| A | **Liquipedia Apex 分站** | 战队、阵容、转会、国际赛事成绩 | MediaWiki API（1 req/2s） | 有国际履历的队覆盖好；纯国内选手常无页面 |
| C | **apexlegendsstatus / DGS 赛事系统** | 国内杯赛逐场数据（击杀 / 伤害 / 圈伤 / 排名） | 公开 JSON API，2 req/s | ⚠️ **只有 IGN，没有跨赛事的选手身份映射**，见 3.3.1。降级为可选核对工具，不进关键路径 |
| A | **Apex BWIKI**（`wiki.biligame.com/apex`） | 历届赛事冠军 / 亚军 / 奖金 / 队伍数 | MediaWiki `api.php` | 星空杯 S1–S7 冠军脉络最全 |
| B | **小黑盒赛事中心** | 赛程、积分榜、对阵 | 仅 App / 网页，无公开 API | 交叉核对用 |
| B | **B 站星空杯官方专题页** | 赛制、参赛名单 | 人工阅读 | 官方一手 |
| B | **B 站 / 虎扑 / 百度百科** | 选手 ID、译名、战队 | 人工阅读 | **不能单独采信** |
| C | **Esports Earnings** | 奖金、国籍 | `api.esportsearnings.com/v0/` + 免费 key | 补国际选手 |
| C | **Cito API** | ALGS 专项 | 500 次/月免费 | 可选，非必需 |

> ⚠️ **ALGS 官网（ea.com/algs）只覆盖 ALGS 赛道**。星空杯、泰坦杯、捍卫者杯这类 B 站 / 斗鱼主办赛事不在其中，不能当国内选手的主来源。

**DGS 赛事 API 速查**（构建期可选，非必需）：

```bash
# 最近 25 个公开赛事
GET https://apexlegendsstatus.com/tournament-stable/ingram/?qt=getTournaments&allGames=1
# 指定赛事的队伍与选手逐项数据
GET https://apexlegendsstatus.com/tournament-stable/ingram/?qt=getScores&tournamentId=10374
# 对局清单
GET https://apexlegendsstatus.com/tournament-stable/ingram/?qt=getGames
# Header: Authorization: <Profile Settings 里的 token>
# 限速: 2 req/s
```

#### 3.3.1 选手身份映射：DGS 解决不了这件事

**核实结论：DGS / apexlegendsstatus 没有跨赛事的选手身份映射。**

- 赛事数据里的选手只有**游戏内名称（IGN）**，会随战队前缀、改名、小号变化
- 结果页 URL 里的哈希标识的是**赛事 / 对局记录**，不是选手
- ALS 唯一稳定的标识是**游戏账号 UID**（`/nametouid` → `/bridge?uid=`），但那是"账号"层，不是"选手"层；国内选手普遍存在多账号、账号不公开的情况，无法当实体键
- PandaScore 有稳定的数值 player ID，但 **Apex 覆盖未确认**，国内选手覆盖更悬

**所以：选手实体只能人工建立。** 做法是：

| 项 | 取值 |
|---|---|
| 实体主键 | 我们自己定义的 `id`（kebab-case，如 `3mz`） |
| 权威出处 | Liquipedia 选手页 URL（一个页面 = 一个实体） |
| 匹配层 | `aliases[]` 人工维护：英文 ID、中文昵称、本名、拼音、常见错拼 |
| 溯源 | 每个字段的 `sources[]` + `verifiedAt` |

> 重名是真实风险：`无名`、`N0NAME`、各类战队前缀 ID 在同一份数据里可能指向不同人。没有人工别名表，自动匹配一定会错。

**DGS 降级为"可选核对工具"，甚至可以先不做。** 猜选手游戏需要的是属性（国家 / 队伍 / 位置 / 传奇 / 出道年份），不是逐场击杀数据——后者对玩法没有贡献。

**结论：属性用 `Liquipedia` + `Apex BWIKI` + 直播/百科交叉核对；成绩用 `Apex BWIKI` 确认，DGS 仅在需要逐场数据时补充。**
最终以人工核对后的 JSON 为准，每个选手记录 `sources[]` 与 `verifiedAt`。

#### 3.3.2 实测：Liquipedia 选手页能拿到什么（2026-11-23）

本机直连测试：

```
HTTP 200 · 1043 ms · 单次请求可查 12 个标题
```

| 名字 | 结果 |
|---|---|
| 3Mz / Roieee / Kasssa / BoLin / Pite / GuGu / WenXx / Nirvana / QQ / CrazyCong | ✅ 有页面 |
| LqDud | ❌ 缺失 → **`LqDuD` ✅**（标题大小写敏感） |
| N0NAME | ❌ 所有变体均无 |

**覆盖率：10/12；加入变体解析后 11/12。**

**infobox 实测字段（3Mz 样本）：**

```wiki
|id=3Mz
|localid=三明治
|ids=GOTAHAVEYO
|name=王虎
|romanized_name=Wang Hu
|nicknames=虎哥, 巨大, huge
|country=China
|status=Active
|years_active=2019 – Present
|birth_date=1998-11-15
|input=Controller
|legends=bangalore
|legends2=Gibraltar
|legends3=Seer
|history={{THA}}
|apexlegendsstatus=1009120900882
|apexlegendsstatusalgs=3Mz
```

**四个样本页的字段覆盖率：**

| 我们的属性 | Liquipedia 字段 | 覆盖率 | 处理方式 |
|---|---|---|---|
| 中文昵称 | `localid` | 3/4 | 直接取 |
| 别名 | `ids` / `nicknames` / `name` / `romanized_name` | 4/4 | 合并进 `aliases[]` |
| 地区 | `country` | 4/4 | 直接取 |
| 出道年份 | `years_active` | 4/4 | 解析起始年 |
| 标志性传奇 | `legends` / `legends2` / `legends3` | 4/4 | 取首个为主 |
| 当前战队 | 只有 `history` 模板 | 4/4 | 解析末项或人工 |
| **位置（IGL / 突破 / 支援）** | **无此字段** | **0/4** | **必须人工标注** |

> 💡 **意外收获**：`apexlegendsstatus` 字段 4/4 都有——Liquipedia 本身就存了选手到 ALS 的 ID 映射。
> 上一节说的"身份映射缺口"，其实已由 Liquipedia 补上了。

**结论：访问不是问题，归一化才是。** 三个真实问题——标题大小写、少数选手无页面、`role` 无字段。

### 3.4 选手池种子清单（待核实，非最终版）

> 下表仅列出调研中**多源出现**的名字，正式入库前须逐条核实属性。

| 档 | 选手 | 关联队伍 | 备注 |
|---|---|---|---|
| 1 | 3Mz（三明治） | DreamFire / EDG | IGL，ALGS 2023 世界赛第 7 |
| 1 | Kasssa（卡莎） | VKG | IGL，MDY 创始人 |
| 1 | QQ | VKG | EWC 2025 FMVP，中国台湾 |
| 1 | 老吊 LqDud | VKG | 中国台湾，老将 |
| 1 | Pite（皮特） | DreamFire | |
| 1 | Roieee（百弟） | DreamFire | 中国台湾 |
| 1 | 飞天狙 FTJ | MDY / VKG | 已退役，现头部主播 |
| 1 | 青野大魔王 | MDY | 星空杯 S1/S2 冠军班底 |
| 1 | CrazyCong（王耀） | Wolves | 队长 |
| 1 | 甜药 | MDY | 需核实现役状态 |
| 2 | WenXx（李文轩） | Wolves | |
| 2 | N0NAME（马梓皓） | Wolves | |
| 2 | Nirvana（陈肖宇） | Wolves | |
| 2 | YouL1ng | VKG | |
| 2 | Cav | VKG | |
| 2 | BoLin（蔡欣龍） | DreamFire | 2022 冠军赛替补 |
| 2 | Taaaao（陳國濤） | DreamFire | 2022 冠军赛替补 |
| 2 | GuGu | DreamFire | |
| 3 | 明月 / zhanshuji 等 | — | 待补 |
| 3 | 国际补充 8~10 人 | — | 如 ImperialHal、Zer0 等，放困难档 |

⚠️ **不建议入池**：有作弊争议或舆论风险的选手。校园招新场合，避免把真人争议当成游戏内容。

### 3.5 数据 Schema

```jsonc
{
  "id": "3mz",
  "name": "3Mz",
  "cn": "三明治",
  "aliases": ["3mz", "三明治", "王虎"],
  "search": ["sanmingzhi", "smz"],        // 构建期由 pinyin-pro 预生成
  "region": "CN",                          // CN | TW | HK | MO | INTL
  "team": "DreamFire",
  "teamHistory": ["DreamFire", "EDG"],
  "role": "IGL",                           // IGL | 突破 | 支援 | 自由人
  "legends": [{ "name": "Wraith", "class": "突击" }],
  "debutYear": 2019,
  "status": "active",                      // active | retired | streamer
  "honor": "国际决赛",                      // 世界冠军 | 国际决赛 | 国内冠军 | 无
  "tier": 1,
  "verified": false,
  "sources": ["https://liquipedia.net/apexlegends/DreamFire"],
  "verifiedAt": "2026-11-23"
}
```

**校验脚本**（`scripts/validate.mjs`）：重复 id / 重复 alias / 未知队伍 / tier 越界 / 未核实项统计。

---

## 4. 视觉与交互

### 4.1 Apex 配色 Token

调研结果有多个版本，按可信度取：

| Token | 色值 | 来源与说明 |
|---|---|---|
| `--apex-red` | `#DA292A` | 多源互证的主红 |
| `--apex-red-press` | `#A81F20` | 按压/悬停态 |
| `--apex-red-alt` | `#ED1B24` | 官方 SVG 取色，备用强调 |
| `--apex-black` | `#161616` | Pantone 426C 对应的品牌深色 |
| `--apex-ink` | `#010101` | 极深背景 |
| `--apex-white` | `#FFFFFF` | |
| `--gray-800` | `#2A2A2A` | 卡片底 |
| `--gray-600` | `#6E6E6E` | 次要文字 |
| `--gray-300` | `#A6A6A6` | 禁用 |
| `--gray-100` | `#E6E6E6` | 浅色分隔 |

**反馈色（语义色，不能沿用品牌红）：**

| Token | 色值 | 用途 |
|---|---|---|
| `--fb-correct` | `#009E73` | 绿（Okabe-Ito 色盲安全绿） |
| `--fb-close` | `#E69F00` | 黄（色盲安全橙黄） |
| `--fb-wrong` | `#8C8C8C` | 灰 |

> 红色是品牌主色，**绝不用来表示"错误"**，否则语义冲突。错误一律用灰。

### 4.2 Spectrum 2 落地规则

不引入 `@adobe/spectrum-wc` 组件库（会和 Apex 主题打架），只借它的交互规范：

1. **注意力层级**：每屏只有一个高注意力元素——开场是「开始」按钮，对局中是输入框
2. **颜色不单独承载信息**：反馈块同时给颜色 + 图标（✓ / ≈ / ✕）+ 箭头（↑↓）
3. **动效三类**：交互动效（按压 0.98 缩放 / 130ms）、方向动效（抽屉/结果卡滑入）、寻路动效（不做）
4. **`prefers-reduced-motion` 必须支持**：关闭所有位移与缩放
5. **焦点可见**：`:focus-visible` 环形描边，偏移 2px，颜色 `#FFFFFF` + 内圈 `#161616`
6. **圆角与图标对齐**：S2 风格更圆润，卡片 12px、按钮 8px、输入框 8px
7. **间距用 4px 栅格**
8. **键盘可达**：下拉支持 ↑↓ Enter Esc，全程可 Tab 走通

### 4.3 移动优先布局

现场以手机/平板为主：

- 375px 起设计，属性反馈为「横向 6 列小方块」在手机上会挤 → 改为 **2×3 网格**
- 输入框用**可搜索下拉**（不是自由文本），支持拼音全拼、首字母、中文昵称
- 触摸目标 ≥ 44×44
- 安全区适配 `env(safe-area-inset-*)`
- 横屏平板用双栏（左输入右历史）

---

## 5. 技术栈与架构

```
Vite + React 19 + TypeScript
├── 样式：CSS Modules + CSS Custom Properties（设计 token）
├── 拼音：pinyin-pro（仅构建期运行，产物为纯字符串数据）
├── 测试：Vitest（反馈算法 + 抽题逻辑）
├── 构建：vite build → dist/
└── 离线：vite-plugin-singlefile → 单文件 HTML 备份
```

**不引入**：Tailwind（token 手写更贴合设计系统）、任何 UI 组件库、任何运行时网络依赖。

### 目录

```
apex-guess/
├── src/
│   ├── data/players.json        # 烘好的 50 人
│   ├── game/                    # 纯函数：抽取、比对、反馈
│   ├── components/              # GuessInput / FeedbackGrid / ResultCard
│   ├── styles/tokens.css
│   └── App.tsx
├── scripts/
│   ├── build-search-index.mjs   # 生成拼音/别名索引
│   ├── validate.mjs             # schema 校验
│   └── fetch-liquipedia.mjs     # 可选：构建期抓取（带 UA + 限速）
├── .github/workflows/deploy.yml
└── TECH-PLAN.md
```

### 无残留实现

- 状态全部在 `useReducer` 内存里
- 显式不写 `document.cookie` / `localStorage` / `sessionStorage` / `indexedDB`
- 不注册 Service Worker
- 不引入任何分析脚本
- 字体用系统栈（PingFang SC / Microsoft YaHei / Noto Sans SC fallback），不发外部字体请求

---

## 6. 部署与现场预案

### 6.1 托管方案对比（2026-11 调研）

| 方案 | 免备案 | 国内可达性 | 3 天可行 | 结论 |
|---|---|---|---|---|
| **GitHub Pages** | 是 | 不稳定，时通时断 | 是 | 满足"GitHub 可部署"要求，但不能做现场唯一通道 |
| **Vercel** | 是 | `*.vercel.app` **已被墙**（GreatFire 2026-11 测试 194/194 失败） | 是 | ❌ 不用 |
| **Netlify** | 是 | `*.netlify.app` 当前可达（2026-10 测试 5/5），TTFB 200–500ms | 是 | ✅ 推荐的在线镜像 |
| **Cloudflare Pages** | 是 | `*.pages.dev` 常白屏 / 被微信拦截；**江苏有失败报告** | 是 | ⚠️ 不绑自定义域名就别用 |
| **Gitee Pages** | 是（需实名） | 国内速度最好 | 是 | ⚠️ 服务状态不稳，需手动点"更新"生效 |
| **腾讯云 EdgeOne Pages** | 部分 | 默认域名大陆仅 3 小时预览；大陆节点必须 ICP 备案 | 部分 | ⚠️ 3 天内不可用 |
| **阿里云 OSS / 腾讯云 COS** | 否 | 需备案域名才能直出 HTML | 否 | ❌ 备案 1–2 周，来不及 |
| **本地单文件** | — | 100% | 是 | ✅ 现场主通道 |

> 南京属江苏，Cloudflare 在江苏有失败报告 —— 直接排除为现场主通道。

### 6.2 推荐：一次构建，三个出口

```
            ┌─→ GitHub Pages   （代码托管 + 作品存档，满足原始要求）
Vite build ─┼─→ Netlify         （国内可达性最好的免费在线镜像，拖拽 dist/ 即部署）
            └─→ 单文件 HTML     （放笔记本，双击即用，断网可玩）
```

**现场流程：**

1. **主通道：摊位放平板 + 手机，直接打开单文件包** —— 不扫码、不联网，访客上手即玩
2. **次通道：海报二维码指向 Netlify 地址**，旁边必须写明「请用手机相机扫码；若用微信扫到白屏，点右上角『在浏览器打开』」
3. **兜底：一台手机开热点，笔记本跑 `npx serve`**，二维码备用指向局域网 IP

> 在线通道是"锦上添花"，单文件包是"保命"。**彩排时必须断网跑通一局。**
> 已确认社团没有可用的已备案域名（2026-11-23），因此**微信内直接打开无法保证**，二维码必须配文字引导。

### 6.3 为什么不做小程序，以及微信里怎么办

**结论：小程序满足"零成本"，但不满足"三天"。**

| 门槛 | 现实 |
|---|---|
| ICP 备案 | 2023-09 起强制。平台初审 1–2 工作日 → 12381 短信核验 → 省通信管理局 **1–20 工作日**（常见 7–15） |
| 版本审核 | 备案通过后再 1–7 天 |
| 合计 | **2–4 周**，3 天窗口不可行 |
| 微信小游戏 | 更严：版号 / 企业主体 / 防沉迷 / 省局备案，个人基本做不了 |
| 费用 | 注册与备案免费——**卡的是时间，不是钱** |

**但有一个真实的坑：微信内置浏览器会拦未备案域名。**

- 表现：白屏 +「如需浏览，请长按网址复制后使用浏览器访问」
- GitHub Pages / Netlify 都是境外未备案域名，大概率命中
- 备案域名刚通过时也可能有 3–5 天缓存延迟

**三条绕开的路：**

1. **现场主通道用设备，不用二维码** —— 摊位放平板/手机直接打开单文件包，不扫码、不联网
2. **二维码写明「请用手机相机扫」** —— 系统相机会直接开浏览器，绕开微信内置内核
3. ~~问社团/学校有没有已备案域名~~ —— **已确认没有（2026-11-23），此路关闭。** 若后续打听到学校信息中心有，再启用。

> 腾讯云 CloudBase 默认域名不解决问题：会弹"访问提示中间页"，非导航请求还会被强制返回下载，官方要求生产环境必须绑自定义域名（=必须备案）。

**小程序留给下一届**：现在免费注册 + 提交备案，明年百团可用。它更适合长期沉淀，但救不了今年的场。

### 6.4 上台前检查清单

- [ ] iOS Safari / Android Chrome / iPad 横竖屏 三端实测
- [ ] **微信内打开在线地址实测**（微信扫一扫 + 系统相机各一次），记录是否白屏
- [ ] 海报上「用手机相机扫码」的提示已印上
- [ ] 断网状态下打开单文件包能完整玩一局
- [ ] 50 名选手均可被搜索到（拼音 / 首字母 / 中文 / ID 四种方式）
- [ ] 连续玩 10 局，无重复出题、无状态残留
- [ ] 刷新页面后回到全新状态
- [ ] 页面底部含「非官方粉丝作品 / 数据参考 Liquipedia / 仅供校内活动」声明

---

## 7. 三天排期

| 天 | 上午 | 下午 | 交付 |
|---|---|---|---|
| **D1** | 项目脚手架、设计 token、schema 定稿 | 50 人数据整理与核实、校验脚本 | 能跑通一局的原型 |
| **D2** | 核心交互（下拉检索、反馈网格、结果卡） | 三档难度、移动端打磨、Spectrum 交互细节 | 视觉完成版 |
| **D3** | 三端测试矩阵 + 修复 | 部署 Pages、打单文件包、现场彩排 | 可上台版本 |

**缓冲**：D3 下午留 3 小时，只做修复不做新功能。

---

## 8. 风险清单

| 风险 | 影响 | 对策 |
|---|---|---|
| 国内选手数据错误 | 高（现场被指出来很尴尬） | 多源交叉 + `verified` 标记 + 结果卡不显示未核实字段 |
| GitHub Pages 国内不通 | 高 | 单文件离线包为主通道 |
| 选手池太小导致重复出题 | 中 | 简单档 10 人偏少，可提到 15；会话内去重 |
| 版权/商标 | 中 | 不用官方 logo/图片，只用文字与几何图形；加非官方声明 |
| 拼音检索不准 | 中 | 构建期人工核对 50 条拼音索引 |
| 多人同时用同一部手机 | 低 | 结果页直接「再来一局」，无需清缓存 |

---

## 9. 待确认（影响 D1 开工）

1. 难题档的"国际补充"具体放谁？（默认 ImperialHal / Zer0 / Genburten 一类）
2. 是否要"连续答对"计数（纯内存，刷新即清）？
3. 现场是否需要中英双语？（默认简体中文）

---

## 10. 参考来源

- shnlfriberg.online / csgofriberg：<https://github.com/shnlfriberg/csgofriberg>
- Liquipedia API 条款：<https://liquipedia.net/api-terms-of-use>
- Liquipedia Apex 选手模板：<https://liquipedia.net/apexlegends/Template:Infobox_player>
- Esports Earnings API：<https://api.esportsearnings.com/apidocs>
- Cito ALGS API：<https://docs.citoapi.com/algs-api/>
- Adobe Spectrum 2：<https://spectrum.adobe.com/>
- Apex 配色（多源）：<https://perfectpalette.io/explore/palettes/app-apex-legends>、<https://brandfetch.com/apexlegends.com>
- VKG / EWC 2025：<https://baike.baidu.com/item/VKG电子竞技俱乐部>
- 星空杯赛事：<https://wiki.biligame.com/apex/>
- DreamFire 队史：<https://liquipedia.net/apexlegends/DreamFire>
