# APEX 猜选手

南京师范大学电竞社 APEX 分部 · 百团招新现场用的小游戏。

Wordle 式猜职业选手：输入选手，按「地区 / 战队 / 位置 / 标志性传奇 / 出道年份 / 最高荣誉」六项返回绿、黄、灰反馈，6 次机会。

**纯静态 · 零后端 · 无 cookie · 无本地存储 · 断网可玩。**

## 开发

```bash
npm install
npm run dev        # 本地开发
npm test           # 单元测试
npm run build      # 产出 dist/
npm run build:single  # 产出 dist-single/index.html（单文件离线包）
```

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并发布到 GitHub Pages。

同时会在 Actions 的 artifacts 里生成 `apex-guess-offline`，下载下来就是可以双击打开的单文件版本——**现场主通道用它**。

## 现场使用

1. 摊位设备直接打开 `dist-single/index.html`（不联网）
2. 海报二维码指向 Pages 地址，并标注「请用手机相机扫码」
3. 备用：手机开热点 + 本地 `npx serve`

## 数据

`src/data/players.json` 是**生成文件，不要手改**。人工字段（难度分档、位置、备注）写在 `src/data/manual.json`。

数据流水线：

| 命令 | 作用 | 限速 |
|---|---|---|
| `npm run fetch:liq` | wikitext 抓取：姓名、别名、国家、出道年 | 1 req / 2s |
| `npm run fetch:html` | 渲染页抓取：当前战队、队伍履历、奖金、S/A 级战绩 | **1 req / 30s** |
| `npm run build:players` | 合并两份抓取 + 人工字段，生成 `players.json` | — |
| `npm run search:index` | 生成拼音 / 首字母搜索索引 | — |
| `npm run validate` | 校验 schema、重复 id、别名冲突、未核实项 | — |

50 名选手的 `fetch:html` 约需 25 分钟，属于构建期一次性任务。

完整设计见 [TECH-PLAN.md](TECH-PLAN.md)。

## 声明

非官方粉丝作品，与 EA / Respawn 无关。数据参考 Liquipedia（CC-BY-SA 3.0）。仅供校内活动使用。
