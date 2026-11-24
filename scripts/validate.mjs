#!/usr/bin/env node
/**
 * 校验 src/data/players.json 的结构与一致性。
 * 退出码 1 表示有错误，可直接用于 CI。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = resolve(__dirname, '../src/data/players.json')

const REGIONS = new Set(['CN', 'TW', 'HK', 'MO', 'INTL'])
const ROLES = new Set(['IGL', '突破', '支援', '自由人'])
const HONORS = new Set(['世界冠军', '国际决赛', '国内冠军', '无'])
const STATUSES = new Set(['active', 'retired', 'streamer'])
const CLASSES = new Set(['突击', '游击', '侦察', '控制', '支援'])
const REQUIRED = [
  'id',
  'name',
  'aliases',
  'search',
  'region',
  'team',
  'role',
  'legends',
  'debutYear',
  'status',
  'honor',
  'tier',
  'verified',
  'sources',
]

const errors = []
const warnings = []

let raw
try {
  raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
} catch (e) {
  console.error(`✕ 读取失败: ${e.message}`)
  process.exit(1)
}

const players = raw.players ?? []
const target = raw._meta?.target ?? 50

const seenIds = new Set()
const aliasOwners = new Map()

for (const p of players) {
  const tag = p.id ?? '(无 id)'

  for (const key of REQUIRED) {
    if (p[key] === undefined || p[key] === null) errors.push(`${tag}: 缺字段 ${key}`)
  }

  if (seenIds.has(p.id)) errors.push(`重复 id: ${p.id}`)
  seenIds.add(p.id)

  if (p.region && !REGIONS.has(p.region)) errors.push(`${tag}: 非法 region ${p.region}`)
  if (p.role && !ROLES.has(p.role)) errors.push(`${tag}: 非法 role ${p.role}`)
  if (p.honor && !HONORS.has(p.honor)) errors.push(`${tag}: 非法 honor ${p.honor}`)
  if (p.status && !STATUSES.has(p.status)) errors.push(`${tag}: 非法 status ${p.status}`)
  if (![1, 2, 3].includes(p.tier)) errors.push(`${tag}: tier 必须是 1/2/3`)

  if (typeof p.debutYear === 'number' && (p.debutYear < 2014 || p.debutYear > 2026)) {
    warnings.push(`${tag}: debutYear ${p.debutYear} 可疑`)
  }

  if (!Array.isArray(p.legends) || p.legends.length === 0) {
    warnings.push(`${tag}: legends 为空（Liquipedia 常缺此字段，需人工补）`)
  } else {
    for (const l of p.legends) {
      if (!l?.name) errors.push(`${tag}: 传奇缺 name`)
      if (!CLASSES.has(l?.class)) errors.push(`${tag}: 传奇 ${l?.name} 的 class 非法: ${l?.class}`)
    }
  }

  if (!Array.isArray(p.sources) || p.sources.length === 0) warnings.push(`${tag}: 没有 sources`)
  if (!p.verified) warnings.push(`${tag}: 未核实`)

  const keys = [p.name, p.cn, ...(p.aliases ?? []), ...(p.search ?? [])]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())

  for (const k of keys) {
    if (!aliasOwners.has(k)) aliasOwners.set(k, new Set())
    aliasOwners.get(k).add(p.id)
  }
}

for (const [key, owners] of aliasOwners) {
  if (owners.size > 1) {
    errors.push(`别名冲突 "${key}" 同时指向: ${[...owners].join(', ')}`)
  }
}

const byTier = { 1: 0, 2: 0, 3: 0 }
for (const p of players) if (p.tier in byTier) byTier[p.tier] += 1
const verified = players.filter((p) => p.verified).length

console.log(`选手总数: ${players.length} / 目标 ${target}`)
console.log(`已核实: ${verified}   未核实: ${players.length - verified}`)
console.log(`分档: 简单 ${byTier[1]} · 中等 ${byTier[2]} · 困难 ${byTier[3]}`)

if (warnings.length > 0) {
  console.log(`\n⚠ 警告 ${warnings.length} 条:`)
  for (const w of warnings) console.log(`  - ${w}`)
}

if (errors.length > 0) {
  console.log(`\n✕ 错误 ${errors.length} 条:`)
  for (const e of errors) console.log(`  - ${e}`)
  process.exit(1)
}

console.log('\n✓ 校验通过')
