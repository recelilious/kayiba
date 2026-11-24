import { describe, expect, it } from 'vitest'
import { bestPlace, compare, formatHonors, matchesQuery } from './feedback'
import type { Player, Placement } from './types'

function player(over: Partial<Player> = {}): Player {
  return {
    id: 'x',
    name: 'X',
    aliases: [],
    search: [],
    country: '中国',
    team: 'T',
    teamHistory: [],
    role: '输出',
    debutYear: 2020,
    status: 'active',
    placements: [],
    earnings: 0,
    tier: 1,
    verified: false,
    sources: [],
    ...over,
  }
}

function place(date: string, place: number, tier: 'S' | 'A' = 'S'): Placement {
  return { date, place, tier, event: 'E' }
}

describe('compare', () => {
  it('完全相同的选手 7 项全绿', () => {
    const p = player()
    const fb = compare(p, p)
    expect(fb).toHaveLength(7)
    expect(fb.every((f) => f.match === 'correct')).toBe(true)
  })

  it('地区不同直接判灰', () => {
    const fb = compare(player({ country: '日本' }), player({ country: '中国' }))
    expect(fb[0].match).toBe('wrong')
  })

  it('当前战队相同为绿', () => {
    const fb = compare(player({ team: 'VKG' }), player({ team: 'VKG' }))
    expect(fb[1].match).toBe('correct')
  })

  it('一方当前战队是对方旧战队时为黄', () => {
    const guess = player({ team: 'DreamFire' })
    const target = player({ team: 'EDG', teamHistory: ['DreamFire'] })
    expect(compare(guess, target)[1].match).toBe('close')
  })

  it('战队履历没有交集则判灰', () => {
    const guess = player({ team: 'Wolves', teamHistory: ['VKG'] })
    const target = player({ team: 'EDG', teamHistory: ['DreamFire'] })
    expect(compare(guess, target)[1].match).toBe('wrong')
  })

  it('位置两档：相同绿，不同灰', () => {
    expect(compare(player({ role: '指挥' }), player({ role: '指挥' }))[2].match).toBe('correct')
    expect(compare(player({ role: '指挥' }), player({ role: '输出' }))[2].match).toBe('wrong')
  })

  it('出道年份相差 2 年以内为黄，超过为灰', () => {
    expect(compare(player({ debutYear: 2020 }), player({ debutYear: 2022 }))[3].match).toBe('close')
    expect(compare(player({ debutYear: 2020 }), player({ debutYear: 2023 }))[3].match).toBe('wrong')
  })

  it('世界赛战绩：都为空算绿，一方为空算灰', () => {
    expect(compare(player(), player())[4].match).toBe('correct')
    expect(compare(player(), player({ placements: [place('2024-01-01', 3)] }))[4].match).toBe('wrong')
  })

  it('世界赛按最高名次比对，差 2 以内为黄', () => {
    const guess = player({ placements: [place('2023-01-01', 5), place('2024-01-01', 9)] })
    const target = player({ placements: [place('2024-06-01', 3)] })
    expect(compare(guess, target)[4].match).toBe('close')
  })

  it('A 级赛事独立比对', () => {
    const guess = player({ placements: [place('2023-01-01', 1, 'A')] })
    const target = player({ placements: [place('2023-01-01', 1, 'A')] })
    expect(compare(guess, target)[5].match).toBe('correct')
  })

  it('奖金相同为绿，2 倍以内为黄，超过 2 倍为灰', () => {
    expect(compare(player({ earnings: 88000 }), player({ earnings: 88000 }))[6].match).toBe('correct')
    expect(compare(player({ earnings: 88000 }), player({ earnings: 120000 }))[6].match).toBe('close')
    expect(compare(player({ earnings: 88000 }), player({ earnings: 170000 }))[6].match).toBe('close')
    expect(compare(player({ earnings: 88000 }), player({ earnings: 180000 }))[6].match).toBe('wrong')
    expect(compare(player({ earnings: 88000 }), player({ earnings: 900000 }))[6].match).toBe('wrong')
  })
})

describe('formatHonors', () => {
  it('按名次从好到差排序，同名次按时间先后，保留全部名次', () => {
    const list = [
      place('2024-01-01', 9),
      place('2022-01-01', 3),
      place('2023-01-01', 3),
      place('2025-01-01', 13),
    ]
    expect(formatHonors(list, 'S')).toBe('#3 #3 #9 #13')
  })

  it('没有战绩时显示破折号', () => {
    expect(formatHonors([], 'S')).toBe('—')
  })
})

describe('bestPlace', () => {
  it('取最小名次，不再忽略 10 名以外', () => {
    expect(bestPlace([place('2024-01-01', 13), place('2023-01-01', 7)], 'S')).toBe(7)
    expect(bestPlace([place('2024-01-01', 13)], 'S')).toBe(13)
    expect(bestPlace([], 'S')).toBe(null)
  })
})

describe('matchesQuery', () => {
  const p = player({
    name: '3Mz',
    cn: '三明治',
    aliases: ['王虎'],
    search: ['sanmingzhi', 'smz'],
  })

  it('大小写不敏感命中英文 ID', () => {
    expect(matchesQuery(p, '3mz')).toBe(true)
    expect(matchesQuery(p, '3MZ')).toBe(true)
  })

  it('命中中文昵称、别名与拼音', () => {
    expect(matchesQuery(p, '三明')).toBe(true)
    expect(matchesQuery(p, '王虎')).toBe(true)
    expect(matchesQuery(p, 'sanming')).toBe(true)
  })

  it('空查询返回全部，不匹配返回 false', () => {
    expect(matchesQuery(p, '   ')).toBe(true)
    expect(matchesQuery(p, 'zzzz')).toBe(false)
  })
})
