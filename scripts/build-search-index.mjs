#!/usr/bin/env node
/**
 * 为 players.json 生成搜索索引。
 * 保留已有 search 项，追加：ID / 中文名 / 别名 / 全拼 / 首字母。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(__dirname, '../src/data/players.json')

const raw = JSON.parse(readFileSync(DATA, 'utf8'))

function pinyinForms(text) {
  if (!text) return []
  try {
    // surname: 'all' 让「曾」「单」「朴」等姓氏按姓氏读音转写（曾丞 → zengcheng，而不是 cengcheng）
    const full = pinyin(text, { toneType: 'none', type: 'array', surname: 'all' }).join('')
    const first = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array', surname: 'all' }).join('')
    return [full, first].filter((s) => s && s !== text)
  } catch {
    return []
  }
}

let changed = 0
for (const p of raw.players ?? []) {
  const set = new Set((p.search ?? []).map((s) => String(s).toLowerCase()))
  const sources = [p.name, p.cn, ...(p.aliases ?? [])].filter(Boolean)

  for (const s of sources) {
    set.add(String(s).toLowerCase())
    for (const form of pinyinForms(String(s))) set.add(form.toLowerCase())
  }

  const next = [...set].filter(Boolean)
  if (JSON.stringify(next) !== JSON.stringify(p.search)) changed += 1
  p.search = next
}

writeFileSync(DATA, JSON.stringify(raw, null, 2) + '\n', 'utf8')
console.log(`已更新 ${changed} 名选手的搜索索引，共 ${raw.players?.length ?? 0} 人`)
