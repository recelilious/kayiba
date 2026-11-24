import { describe, expect, it } from 'vitest'
import { compare, matchesQuery } from './feedback'
import type { Player } from './types'

function player(over: Partial<Player> = {}): Player {
  return {
    id: 'x',
    name: 'X',
    aliases: [],
    search: [],
    region: 'CN',
    team: 'T',
    role: 'IGL',
    legends: [{ name: 'Bangalore', class: '突击' }],
    debutYear: 2020,
    status: 'active',
    honor: '无',
    tier: 1,
    verified: false,
    sources: [],
    ...over,
  }
}

describe('compare', () => {
  it('完全相同的选手全绿', () => {
    const p = player()
    const fb = compare(p, p)
    expect(fb).toHaveLength(6)
    expect(fb.every((f) => f.match === 'correct')).toBe(true)
  })

  it('大陆与台湾算接近，与海外算错误', () => {
    const tw = player({ region: 'TW' })
    const intl = player({ region: 'INTL' })
    const target = player({ region: 'CN' })
    expect(compare(tw, target)[0].match).toBe('close')
    expect(compare(intl, target)[0].match).toBe('wrong')
  })

  it('位置相邻算接近', () => {
    const fb = compare(player({ role: '突破' }), player({ role: '自由人' }))
    expect(fb[2].match).toBe('close')
  })

  it('出道年份 ±2 年内算接近并给出箭头', () => {
    const fb = compare(player({ debutYear: 2019 }), player({ debutYear: 2021 }))
    expect(fb[4].match).toBe('close')
    expect(fb[4].hint).toBe('up')
  })

  it('年份差距大时箭头仍然给出', () => {
    const fb = compare(player({ debutYear: 2015 }), player({ debutYear: 2022 }))
    expect(fb[4].match).toBe('wrong')
    expect(fb[4].hint).toBe('up')
  })

  it('同定位不同传奇算接近', () => {
    const fb = compare(
      player({ legends: [{ name: 'Octane', class: '游击' }] }),
      player({ legends: [{ name: 'Wraith', class: '游击' }] }),
    )
    expect(fb[3].match).toBe('close')
  })

  it('荣誉相邻档算接近', () => {
    const fb = compare(player({ honor: '国内冠军' }), player({ honor: '国际决赛' }))
    expect(fb[5].match).toBe('close')
    expect(fb[5].hint).toBe('up')
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

  it('命中中文昵称与别名', () => {
    expect(matchesQuery(p, '三明')).toBe(true)
    expect(matchesQuery(p, '王虎')).toBe(true)
  })

  it('命中拼音索引', () => {
    expect(matchesQuery(p, 'sanming')).toBe(true)
  })

  it('空查询返回全部', () => {
    expect(matchesQuery(p, '   ')).toBe(true)
  })

  it('不匹配返回 false', () => {
    expect(matchesQuery(p, 'zzzz')).toBe(false)
  })
})
