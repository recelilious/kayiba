#!/usr/bin/env node
/**
 * 把两份抓取结果 + 人工字段合并成 src/data/players.json。
 *
 * 输入：
 *   liquipedia-draft.json        wikitext 抓取（姓名 / 别名 / 国家 / 出道年）
 *   liquipedia-html-draft.json   渲染页抓取（战队 / 履历 / 奖金 / 战绩）
 *   manual.json                  人工维护（难度 / 位置 / 核实状态 / 备注）
 *
 * 输出：src/data/players.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'))

const WIKI = 'src/data/liquipedia-draft.json'
const HTML_DRAFT = 'src/data/liquipedia-html-draft.json'
const MANUAL = 'src/data/manual.json'
const OUT = 'src/data/players.json'

/** Liquipedia 的国家名 → 中文。港澳台统一并入「中国」 */
const COUNTRY = {
  China: '中国',
  Taiwan: '中国',
  'Chinese Taipei': '中国',
  'Hong Kong': '中国',
  Macau: '中国',
  'United States': '美国',
  USA: '美国',
  Canada: '加拿大',
  Japan: '日本',
  'South Korea': '韩国',
  Korea: '韩国',
  Australia: '澳大利亚',
  Sweden: '瑞典',
  Norway: '挪威',
  Finland: '芬兰',
  Denmark: '丹麦',
  Germany: '德国',
  France: '法国',
  'United Kingdom': '英国',
  Brazil: '巴西',
  Russia: '俄罗斯',
  Poland: '波兰',
  Italy: '意大利',
  Spain: '西班牙',
  Mexico: '墨西哥',
  Argentina: '阿根廷',
  Thailand: '泰国',
  Singapore: '新加坡',
  Malaysia: '马来西亚',
  Philippines: '菲律宾',
  India: '印度',
  Indonesia: '印度尼西亚',
  Vietnam: '越南',
}

/** years_active 缺失时，用队伍履历 / 战绩的最早年份兜底（数据来自 Liquipedia 本身） */
function earliestYear(h) {
  const years = [...(h.history ?? []).map((x) => x.range), ...(h.results ?? []).map((x) => x.date)]
    .map((s) => Number(String(s ?? '').match(/^(\d{4})/)?.[1]))
    .filter((y) => Number.isFinite(y) && y >= 2014 && y <= 2026)
  return years.length > 0 ? Math.min(...years) : 0
}

function slugify(title) {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (ascii) return ascii
  // 纯中文页面标题（如「战术级子轩」）没有 ASCII 部分，用拼音兜底
  const romanized = pinyin(title, { toneType: 'none', type: 'array' }).join('-')
  return (
    romanized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'player'
  )
}

function main() {
  if (!existsSync(resolve(ROOT, WIKI))) {
    console.error(`缺少 ${WIKI}，先跑 npm run fetch:liq`)
    process.exit(1)
  }
  if (!existsSync(resolve(ROOT, HTML_DRAFT))) {
    console.error(`缺少 ${HTML_DRAFT}，先跑 npm run fetch:html`)
    process.exit(1)
  }

  const wiki = read(WIKI).players ?? []
  const html = read(HTML_DRAFT).players ?? []
  const manual = read(MANUAL).players ?? {}

  const htmlByTitle = new Map(html.map((p) => [p.title, p]))
  const players = []
  const skipped = []

  for (const w of wiki) {
    if (!w.found) continue

    const slug = slugify(w.title)
    const h = htmlByTitle.get(w.title)
    const m = manual[slug] ?? {}

    if (!h || !h.found) {
      skipped.push(`${w.title}（缺 HTML 数据）`)
      continue
    }

    // 履历里会混进「Retired」「Free Agent」这类非战队值，先剔掉
    const NON_TEAM = /^(retired|inactive|free agent|无)$/i
    const historyTeams = (h.history ?? [])
      .map((x) => x.team)
      .filter((t) => t && !NON_TEAM.test(t))

    // 没有「当前战队」时（退役 / 自由人）退回最近一支战队，并在备注里说明
    const effectiveTeam = h.currentTeam || historyTeams.at(-1) || '无'
    const teamHistory = [...new Set(historyTeams.filter((t) => t !== effectiveTeam))]
    const teamIsHistorical = !h.currentTeam && effectiveTeam !== '无'

    const placements = (h.results ?? [])
      .filter((r) => (r.tier === 'S' || r.tier === 'A') && Number.isFinite(r.place) && r.place >= 1)
      .map((r) => ({ date: r.date, place: r.place, tier: r.tier, event: r.event }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ids 是选手用过的其他 ID（如 BoLin 曾用 Boring），localid 是中文昵称，一并算作别名
    const aliases = [
      ...new Set(
        [w.name, w.romanized, w.localid, ...(w.ids ?? []), ...(w.nicknames ?? [])].filter(Boolean),
      ),
    ]

    const derivedDebut = w.debutYear ?? earliestYear(h)

    players.push({
      id: slug,
      // 页面标题是选手 ID 的规范写法（infobox 的 id 有时是小写，如 kuRong / xd）
      name: w.title || w.id,
      ...(w.localid ? { cn: w.localid } : {}),
      aliases,
      search: [],
      country: COUNTRY[h.nationality] ?? COUNTRY[w.country] ?? h.nationality ?? w.country ?? '',
      team: effectiveTeam,
      teamHistory,
      role: m.role === '指挥' ? '指挥' : '输出',
      debutYear: derivedDebut,
      status: (h.status ?? '').toLowerCase() === 'retired' ? 'retired' : 'active',
      placements,
      earnings: h.earnings ?? 0,
      tier: [1, 2, 3].includes(m.tier) ? m.tier : 2,
      verified: Boolean(m.verified),
      ...(() => {
        const parts = []
        if (m.notes) parts.push(m.notes)
        if (!w.debutYear && derivedDebut) {
          parts.push(`出道年按队伍履历最早年份推断为 ${derivedDebut}（Liquipedia 未填 years_active）`)
        }
        if (teamIsHistorical) parts.push(`当前无战队，显示最近一支：${effectiveTeam}`)
        return parts.length > 0 ? { notes: parts.join('；') } : {}
      })(),
      sources: [`https://liquipedia.net/apexlegends/${encodeURIComponent(w.title)}`],
    })
  }

  players.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))

  writeFileSync(
    resolve(ROOT, OUT),
    JSON.stringify(
      {
        _meta: {
          note: '由 scripts/build-players.mjs 生成，请勿手改。人工字段写在 manual.json。',
          updated: new Date().toISOString().slice(0, 10),
          target: 50,
        },
        players,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  const withHonors = players.filter((p) => p.placements.length > 0).length
  console.log(`生成 ${players.length} 名选手 → ${OUT}`)
  console.log(`其中有战绩记录: ${withHonors}`)
  if (skipped.length > 0) {
    console.log(`\n⚠ 跳过 ${skipped.length} 人:`)
    for (const s of skipped) console.log(`  - ${s}`)
  }
}

main()
