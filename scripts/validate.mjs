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

const ROLES = new Set(['指挥', '输出'])
const STATUSES = new Set(['active', 'retired', 'streamer'])
const EVENT_TIERS = new Set(['S', 'A'])
const REQUIRED = [
  'id',
  'name',
  'aliases',
  'search',
  'country',
  'team',
  'teamHistory',
  'role',
  'debutYear',
  'status',
  'placements',
  'earnings',
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
/** 拼音 / 首字母索引的重合是常态（小雨和 小野的缩写都是 xy），单独统计，不算错误 */
const searchOwners = new Map()

for (const p of players) {
  const tag = p.id ?? '(无 id)'

  for (const key of REQUIRED) {
    if (p[key] === undefined || p[key] === null) errors.push(`${tag}: 缺字段 ${key}`)
  }

  if (seenIds.has(p.id)) errors.push(`重复 id: ${p.id}`)
  seenIds.add(p.id)

  if (p.role && !ROLES.has(p.role)) errors.push(`${tag}: 非法 role ${p.role}`)
  if (p.status && !STATUSES.has(p.status)) errors.push(`${tag}: 非法 status ${p.status}`)
  if (![1, 2, 3].includes(p.tier)) errors.push(`${tag}: tier 必须是 1/2/3`)

  if (!p.country) errors.push(`${tag}: country 为空`)
  if (!p.team) errors.push(`${tag}: team 为空`)

  if (typeof p.debutYear === 'number' && (p.debutYear < 2014 || p.debutYear > 2026)) {
    warnings.push(`${tag}: debutYear ${p.debutYear} 可疑`)
  }

  if (typeof p.earnings !== 'number' || p.earnings < 0) {
    errors.push(`${tag}: earnings 必须是非负数`)
  } else if (p.earnings === 0) {
    warnings.push(`${tag}: earnings 为 0，可能没抓到`)
  }

  if (!Array.isArray(p.placements)) {
    errors.push(`${tag}: placements 必须是数组`)
  } else {
    for (const pl of p.placements) {
      if (!EVENT_TIERS.has(pl?.tier)) errors.push(`${tag}: 战绩 tier 非法 ${pl?.tier}`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(pl?.date ?? '')) errors.push(`${tag}: 战绩日期非法 ${pl?.date}`)
      if (!(pl?.place >= 1)) errors.push(`${tag}: 战绩名次越界 ${pl?.place}`)
    }
  }

  if (!Array.isArray(p.aliases) || p.aliases.length === 0) warnings.push(`${tag}: 没有别名`)
  if (!Array.isArray(p.sources) || p.sources.length === 0) warnings.push(`${tag}: 没有 sources`)
  if (!p.verified) warnings.push(`${tag}: 未核实`)

  // 字面量的名字 / 中文名 / 别名必须唯一：同一串不能同时指向两个人
  const literalKeys = [p.name, p.cn, ...(p.aliases ?? [])]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())

  for (const k of literalKeys) {
    if (!aliasOwners.has(k)) aliasOwners.set(k, new Set())
    aliasOwners.get(k).add(p.id)
  }

  // 搜索索引里的拼音 / 首字母允许重合，只统计
  for (const s of p.search ?? []) {
    const k = String(s).toLowerCase()
    if (!k || literalKeys.includes(k)) continue
    if (!searchOwners.has(k)) searchOwners.set(k, new Set())
    searchOwners.get(k).add(p.id)
  }
}

for (const [key, owners] of aliasOwners) {
  if (owners.size > 1) errors.push(`别名冲突 "${key}" 同时指向: ${[...owners].join(', ')}`)
}

const searchClashes = [...searchOwners].filter(([, owners]) => owners.size > 1)
if (searchClashes.length > 0) {
  const detail = searchClashes.map(([k, owners]) => `${k}=${[...owners].join('/')}`).join('；')
  warnings.push(`搜索索引: ${searchClashes.length} 组拼音重合（${detail}），输入时会同时出现多名候选，非错误`)
}

const byTier = { 1: 0, 2: 0, 3: 0 }
for (const p of players) if (p.tier in byTier) byTier[p.tier] += 1

const verified = players.filter((p) => p.verified).length
const withS = players.filter((p) => (p.placements ?? []).some((x) => x.tier === 'S')).length
const withA = players.filter((p) => (p.placements ?? []).some((x) => x.tier === 'A')).length
const withMoney = players.filter((p) => (p.earnings ?? 0) > 0).length

console.log(`选手总数: ${players.length} / 目标 ${target}`)
console.log(`已核实: ${verified}   未核实: ${players.length - verified}`)
console.log(`分档: 简单 ${byTier[1]} · 中等 ${byTier[2]} · 困难 ${byTier[3]}`)
console.log(`有 S 级战绩: ${withS}   有 A 级战绩: ${withA}   有奖金数据: ${withMoney}`)

if (warnings.length > 0) {
  console.log(`\n⚠ 警告 ${warnings.length} 条:`)
  const grouped = new Map()
  for (const w of warnings) {
    if (!grouped.has(w.split(':')[1]?.trim())) grouped.set(w.split(':')[1]?.trim(), [])
    grouped.get(w.split(':')[1]?.trim()).push(w.split(':')[0])
  }
  for (const [reason, ids] of grouped) {
    console.log(`  - ${reason} (${ids.length}): ${ids.join(', ')}`)
  }
}

if (errors.length > 0) {
  console.log(`\n✕ 错误 ${errors.length} 条:`)
  for (const e of errors) console.log(`  - ${e}`)
  process.exit(1)
}

console.log('\n✓ 校验通过')
