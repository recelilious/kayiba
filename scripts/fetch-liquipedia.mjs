#!/usr/bin/env node
/**
 * 从 Liquipedia 拉取 Apex 选手页并解析 infobox，产出草稿 JSON。
 *
 * 合规要点（见 TECH-PLAN.md 3.1）：
 * - MediaWiki API 限速 1 请求 / 2 秒
 * - 必须带可识别 User-Agent
 * - 单次批量查询 20 个标题
 * - 只读公开页面，非商业用途，署名 Liquipedia
 *
 * 用法：
 *   npm run fetch:liq                  # 读 src/data/roster.txt
 *   npm run fetch:liq -- 3Mz Kasssa    # 指定选手
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const API = 'https://liquipedia.net/apexlegends/api.php'
const UA = 'APEXGuessBooth/0.1 (university club project; non-commercial)'
const DELAY_MS = 2000
const BATCH_SIZE = 20
const OUT = resolve(ROOT, 'src/data/liquipedia-draft.json')
const ROSTER = resolve(ROOT, 'src/data/roster.txt')

const KEEP_FIELDS = [
  'id',
  'localid',
  'ids',
  'name',
  'romanized_name',
  'nicknames',
  'country',
  'status',
  'years_active',
  'birth_date',
  'input',
  'legends',
  'legends2',
  'legends3',
  'history',
  'apexlegendsstatus',
  'apexlegendsstatusalgs',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const legendClasses = JSON.parse(readFileSync(resolve(ROOT, 'src/data/legends.json'), 'utf8')).classes
/** Liquipedia 里的传奇名是小写，映射表是首字母大写，所以用大小写无关的查找 */
const legendLookup = new Map(
  Object.entries(legendClasses).map(([name, cls]) => [name.toLowerCase(), { name, class: cls }]),
)

function resolveLegend(raw) {
  const hit = legendLookup.get(raw.toLowerCase())
  return hit ?? { name: raw, class: null }
}

function loadNames() {
  const fromArgs = process.argv.slice(2).filter(Boolean)
  if (fromArgs.length > 0) return fromArgs
  const text = readFileSync(ROSTER, 'utf8')
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

async function api(params) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', redirects: '1', ...params })
  const res = await fetch(`${API}?${qs}`, {
    headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function clean(value) {
  if (!value) return ''
  return value
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseInfobox(wikitext) {
  const start = wikitext.indexOf('{{Infobox player')
  if (start === -1) return null
  const lines = wikitext.slice(start).split(/\r?\n/)
  const fields = {}
  let current = null

  for (const line of lines.slice(1)) {
    if (line.startsWith('}}')) break
    const m = line.match(/^\|\s*([a-z0-9_]+)\s*=\s*(.*)$/i)
    if (m) {
      current = m[1].toLowerCase()
      fields[current] = m[2]
    } else if (current && line.trim() && !line.trim().startsWith('|')) {
      fields[current] += ' ' + line.trim()
    }
  }
  return fields
}

function splitList(value) {
  return clean(value)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseYear(value) {
  const m = clean(value).match(/(\d{4})/)
  return m ? Number(m[1]) : undefined
}

function buildDraft(title, fields) {
  if (!fields) return { title, found: true, parsed: false }

  const legends = ['legends', 'legends2', 'legends3']
    .map((k) => clean(fields[k] ?? ''))
    .filter(Boolean)
    .map((name) => resolveLegend(name))

  const raw = Object.fromEntries(
    Object.entries(fields).filter(([k]) => KEEP_FIELDS.includes(k)),
  )

  return {
    title,
    found: true,
    parsed: true,
    id: clean(fields.id) || title,
    name: clean(fields.name),
    romanized: clean(fields.romanized_name),
    localid: clean(fields.localid),
    nicknames: splitList(fields.nicknames),
    country: clean(fields.country),
    debutYear: parseYear(fields.years_active),
    birthDate: clean(fields.birth_date),
    legends,
    alsId: clean(fields.apexlegendsstatus),
    allKeys: Object.keys(fields).sort(),
    raw,
  }
}

async function main() {
  const names = loadNames()
  if (names.length === 0) {
    console.error('没有可抓取的选手名：请在 src/data/roster.txt 里填，或作为参数传入。')
    process.exit(1)
  }

  console.log(`准备抓取 ${names.length} 个选手，每批 ${BATCH_SIZE}，间隔 ${DELAY_MS}ms\n`)

  const results = []
  const totalBatches = Math.ceil(names.length / BATCH_SIZE)

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE)
    console.log(`[${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches}] ${batch.join(', ')}`)

    const data = await api({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: batch.join('|'),
    })

    const pages = data?.query?.pages ?? []

    for (const name of batch) {
      const page =
        pages.find((p) => p.title === name) ??
        pages.find((p) => p.title.toLowerCase() === name.toLowerCase())

      if (!page || page.missing) {
        results.push({ title: name, found: false })
        continue
      }

      const wikitext = page.revisions?.[0]?.slots?.main?.content ?? ''
      results.push(buildDraft(page.title, parseInfobox(wikitext)))
    }

    if (i + BATCH_SIZE < names.length) await sleep(DELAY_MS)
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      { _meta: { fetchedAt: new Date().toISOString(), source: API }, players: results },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  const found = results.filter((r) => r.found).length
  const parsed = results.filter((r) => r.parsed).length
  console.log(`\n完成：找到 ${found}/${results.length}，解析出 infobox ${parsed} 个`)
  console.log(`输出：${OUT}`)

  const missing = results.filter((r) => !r.found).map((r) => r.title)
  if (missing.length > 0) console.log(`缺失：${missing.join(', ')}`)

  const unclassified = results
    .flatMap((r) => r.legends ?? [])
    .filter((l) => !l.class)
    .map((l) => l.name)
  if (unclassified.length > 0) {
    console.log(`\n⚠ 以下传奇未在 legends.json 里配置职业：${[...new Set(unclassified)].join(', ')}`)
  }
}

main().catch((e) => {
  console.error('抓取失败:', e.message)
  process.exit(1)
})
