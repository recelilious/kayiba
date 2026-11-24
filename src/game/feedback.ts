import type { AttrKey, Feedback, Honor, Player, Region, Role } from './types'

export const ATTR_LABELS: Record<AttrKey, string> = {
  region: '地区',
  team: '战队',
  role: '位置',
  legend: '传奇',
  debutYear: '出道',
  honor: '荣誉',
}

export const ATTR_ORDER: AttrKey[] = ['region', 'team', 'role', 'legend', 'debutYear', 'honor']

/** 大中华区算「接近」，海外单独一组 */
const REGION_GROUP: Record<Region, 'CN' | 'INTL'> = {
  CN: 'CN',
  TW: 'CN',
  HK: 'CN',
  MO: 'CN',
  INTL: 'INTL',
}

/** 位置相近关系（对称） */
const ROLE_NEIGHBORS: Record<Role, Role[]> = {
  IGL: ['支援'],
  突破: ['自由人'],
  支援: ['IGL'],
  自由人: ['突破'],
}

const HONOR_RANK: Record<Honor, number> = {
  世界冠军: 3,
  国际决赛: 2,
  国内冠军: 1,
  无: 0,
}

export function regionLabel(r: Region): string {
  switch (r) {
    case 'CN':
      return '中国大陆'
    case 'TW':
      return '中国台湾'
    case 'HK':
      return '中国香港'
    case 'MO':
      return '中国澳门'
    case 'INTL':
      return '海外'
  }
}

function regionMatch(guess: Region, target: Region) {
  if (guess === target) return 'correct' as const
  return REGION_GROUP[guess] === REGION_GROUP[target] ? ('close' as const) : ('wrong' as const)
}

function roleMatch(guess: Role, target: Role) {
  if (guess === target) return 'correct' as const
  return ROLE_NEIGHBORS[guess].includes(target) ? ('close' as const) : ('wrong' as const)
}

function yearMatch(guess: number, target: number) {
  const diff = target - guess
  if (diff === 0) return { match: 'correct' as const, hint: undefined }
  if (Math.abs(diff) <= 2) {
    return { match: 'close' as const, hint: diff > 0 ? ('up' as const) : ('down' as const) }
  }
  return { match: 'wrong' as const, hint: diff > 0 ? ('up' as const) : ('down' as const) }
}

function honorMatch(guess: Honor, target: Honor) {
  const g = HONOR_RANK[guess]
  const t = HONOR_RANK[target]
  if (g === t) return { match: 'correct' as const, hint: undefined }
  return {
    match: Math.abs(g - t) === 1 ? ('close' as const) : ('wrong' as const),
    hint: t > g ? ('up' as const) : ('down' as const),
  }
}

/**
 * 纯函数：把一次猜测与答案比对，返回 6 项反馈。
 * 不读取任何外部状态，便于单测。
 */
export function compare(guess: Player, target: Player): Feedback[] {
  const gl = guess.legends[0]
  const tl = target.legends[0]
  const year = yearMatch(guess.debutYear, target.debutYear)
  const honor = honorMatch(guess.honor, target.honor)

  return [
    {
      key: 'region',
      label: ATTR_LABELS.region,
      value: regionLabel(guess.region),
      match: regionMatch(guess.region, target.region),
    },
    {
      key: 'team',
      label: ATTR_LABELS.team,
      value: guess.team,
      match: guess.team === target.team ? 'correct' : 'wrong',
    },
    {
      key: 'role',
      label: ATTR_LABELS.role,
      value: guess.role,
      match: roleMatch(guess.role, target.role),
    },
    {
      key: 'legend',
      label: ATTR_LABELS.legend,
      value: gl?.name ?? '—',
      match:
        !gl || !tl ? 'wrong' : gl.name === tl.name ? 'correct' : gl.class === tl.class ? 'close' : 'wrong',
    },
    {
      key: 'debutYear',
      label: ATTR_LABELS.debutYear,
      value: String(guess.debutYear),
      match: year.match,
      hint: year.hint,
    },
    {
      key: 'honor',
      label: ATTR_LABELS.honor,
      value: guess.honor,
      match: honor.match,
      hint: honor.hint,
    },
  ]
}

/** 搜索匹配：名称 / 中文名 / 别名 / 拼音索引，任一命中即可 */
export function matchesQuery(player: Player, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const haystack = [player.name, player.cn ?? '', ...player.aliases, ...player.search]
  return haystack.some((s) => s.toLowerCase().includes(q))
}
