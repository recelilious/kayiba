#!/usr/bin/env node
/**
 * 从 Liquipedia 的「渲染后 HTML」抓取 wikitext 里拿不到的结构化数据：
 * 当前战队、队伍履历、生涯奖金、带 S/A 分级的战绩。
 *
 * ⚠️ action=parse 的限速是 1 请求 / 30 秒（比普通 API 严格得多）。
 *    50 名选手约需 25 分钟，属于构建期一次性任务。
 *
 * 用法：
 *   npm run fetch:html                 # 读 src/data/roster.txt
 *   npm run fetch:html -- 3Mz Kasssa   # 指定选手
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'node-html-parser'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const API = 'https://liquipedia.net/apexlegends/api.php'
const UA = 'APEXGuessBooth/0.1 (university club project; non-commercial)'
const DELAY_MS = 30_000
const OUT = resolve(ROOT, 'src/data/liquipedia-html-draft.json')
const ROSTER = resolve(ROOT, 'src/data/roster.txt')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadNames() {
  const fromArgs = process.argv.slice(2).filter(Boolean)
  if (fromArgs.length > 0) return fromArgs
  return readFileSync(ROSTER, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

function norm(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/** 从 infobox 的「标签 → 值」结构里取值，图片型字段回退到 alt / title */
function labelValue(root, label) {
  for (const desc of root.querySelectorAll('.infobox-description')) {
    const text = norm(desc.text)
    if (!text.startsWith(label)) continue

    const parent = desc.parentNode
    if (!parent) continue

    const elems = parent.childNodes.filter((n) => n.nodeType === 1)
    const index = elems.indexOf(desc)
    const valueEl = index >= 0 ? elems[index + 1] : null
    if (!valueEl) return ''

    const txt = norm(valueEl.text)
    if (txt) return txt

    const img = valueEl.querySelector('img[alt]')
    if (img) return img.getAttribute('alt') ?? ''

    const link = valueEl.querySelector('a[title]')
    return link?.getAttribute('title') ?? ''
  }
  return ''
}

/** History 段落：日期区间 → 战队 */
function parseHistory(root) {
  const header = root.querySelectorAll('.infobox-header').find((h) => norm(h.text) === 'History')
  const section = header?.parentNode?.parentNode
  if (!section) return []

  const out = []
  for (const tr of section.querySelectorAll('table tr')) {
    const tds = tr.querySelectorAll('td')
    if (tds.length < 2) continue

    const range = norm(tds[0].text)
    const second = tds[1]
    const team = norm(second.querySelector('a')?.text ?? second.text)
      .replace(/\s*\((Inactive|Loan)\)\s*$/i, '')
      .trim()
    if (!team) continue

    out.push({ range, team, raw: norm(second.text) })
  }
  return out
}

/** 战绩表：Date / Place / Tier / Tournament / Team / Prize */
function parseResults(root) {
  let table = null
  for (const candidate of root.querySelectorAll('table.table2__table')) {
    const heads = candidate.querySelectorAll('th').map((th) => norm(th.text))
    if (heads.includes('Place') && heads.includes('Tier')) {
      table = candidate
      break
    }
  }
  if (!table) return []

  const out = []
  for (const tr of table.querySelectorAll('tr')) {
    if (!(tr.getAttribute('class') ?? '').includes('row--body')) continue

    const tds = tr.querySelectorAll('td')
    if (tds.length < 6) continue

    const date = norm(tds[0].text)
    const placeText = norm(tr.querySelector('.placement-text')?.text ?? '')
    const place = Number((placeText.match(/\d+/) ?? [])[0])
    if (!Number.isFinite(place)) continue

    const tierText = norm(tds[2].text)
    const tier = tierText.startsWith('S-') ? 'S' : tierText.startsWith('A-') ? 'A' : null
    if (!tier) continue

    const event =
      tds[3]?.querySelector('a[title]')?.getAttribute('title') ?? norm(tds[3]?.text ?? '')

    out.push({
      date,
      place,
      tier,
      event,
      team: norm(tds[5]?.text ?? ''),
      prize: norm(tds[6]?.text ?? ''),
    })
  }
  return out
}

function parseMoney(text) {
  const digits = (text ?? '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

async function fetchPage(page) {
  const qs = new URLSearchParams({
    action: 'parse',
    format: 'json',
    formatversion: '2',
    prop: 'text',
    page,
  })
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.info ?? 'parse error')
  return json.parse?.text ?? ''
}

function extract(html) {
  const root = parse(html)
  return {
    currentTeam: labelValue(root, 'Team:'),
    nationality: labelValue(root, 'Nationality:'),
    status: labelValue(root, 'Status:'),
    yearsActive: labelValue(root, 'Years Active'),
    born: labelValue(root, 'Born:'),
    earnings: parseMoney(labelValue(root, 'Approx. Total Winnings:')),
    earningsText: labelValue(root, 'Approx. Total Winnings:'),
    history: parseHistory(root),
    results: parseResults(root),
  }
}

async function main() {
  const names = loadNames()
  if (names.length === 0) {
    console.error('没有可抓取的选手名。')
    process.exit(1)
  }

  const total = names.length
  const est = Math.ceil(((total - 1) * DELAY_MS) / 60000)
  console.log(`准备抓取 ${total} 人，间隔 ${DELAY_MS / 1000}s，预计 ${est} 分钟\n`)

  const players = []
  for (let i = 0; i < total; i += 1) {
    const name = names[i]
    const started = Date.now()
    try {
      const html = await fetchPage(name)
      const data = extract(html)
      players.push({ title: name, found: true, ...data })
      const sTier = data.results.filter((r) => r.tier === 'S').length
      const aTier = data.results.filter((r) => r.tier === 'A').length
      console.log(
        `[${i + 1}/${total}] ${name}  team=${data.currentTeam || '-'}  earnings=${data.earnings}  S=${sTier} A=${aTier}  history=${data.history.length}`,
      )
    } catch (e) {
      players.push({ title: name, found: false, error: e.message })
      console.log(`[${i + 1}/${total}] ${name}  FAILED: ${e.message}`)
    }

    if (i < total - 1) {
      const elapsed = Date.now() - started
      const wait = Math.max(0, DELAY_MS - elapsed)
      await sleep(wait)
    }
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      { _meta: { fetchedAt: new Date().toISOString(), source: `${API} (action=parse)` }, players },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  const ok = players.filter((p) => p.found).length
  console.log(`\n完成 ${ok}/${total}，输出：${OUT}`)
}

main().catch((e) => {
  console.error('抓取失败:', e.message)
  process.exit(1)
})
