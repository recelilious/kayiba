import type { AttrKey, EventTier, Feedback, Match, Placement, Player } from './types'

export const ATTR_LABELS: Record<AttrKey, string> = {
  country: '地区',
  team: '战队',
  role: '位置',
  debutYear: '出道',
  worldHonor: '世界赛',
  aTierHonor: 'A级赛',
  earnings: '奖金',
}

export const ATTR_ORDER: AttrKey[] = [
  'country',
  'team',
  'role',
  'debutYear',
  'worldHonor',
  'aTierHonor',
  'earnings',
]

export function formatEarnings(amount: number): string {
  return '$' + amount.toLocaleString('en-US')
}

/** 取出某一级别、10 名以内的战绩，按参赛时间先后排序 */
export function honorsOf(placements: Placement[], tier: EventTier): Placement[] {
  return placements
    .filter((p) => p.tier === tier && p.place <= 10)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function formatHonors(placements: Placement[], tier: EventTier): string {
  const list = honorsOf(placements, tier)
  return list.length === 0 ? '—' : list.map((p) => `#${p.place}`).join(' ')
}

/** 用于比对的「最高名次」，没有则返回 null */
export function bestPlace(placements: Placement[], tier: EventTier): number | null {
  const list = honorsOf(placements, tier)
  return list.length === 0 ? null : Math.min(...list.map((p) => p.place))
}

function honorMatch(guess: number | null, target: number | null): Match {
  if (guess === null && target === null) return 'correct'
  if (guess === null || target === null) return 'wrong'
  if (guess === target) return 'correct'
  return Math.abs(guess - target) <= 2 ? 'close' : 'wrong'
}

/** 金额相同为绿，同一量级（10 倍以内）为黄 */
function earningsMatch(guess: number, target: number): Match {
  if (guess === target) return 'correct'
  if (guess <= 0 || target <= 0) return 'wrong'
  return Math.abs(Math.log10(guess / target)) < 1 ? 'close' : 'wrong'
}

/** 当前战队相同为绿；一方当前战队是另一方「曾经待过、现在不在」的战队为黄 */
function teamMatch(guess: Player, target: Player): Match {
  if (guess.team === target.team) return 'correct'
  if (target.teamHistory.includes(guess.team)) return 'close'
  if (guess.teamHistory.includes(target.team)) return 'close'
  return 'wrong'
}

function yearMatch(guess: number, target: number): Match {
  const diff = Math.abs(target - guess)
  if (diff === 0) return 'correct'
  return diff <= 2 ? 'close' : 'wrong'
}

/**
 * 纯函数：把一次猜测与答案比对，返回 7 项反馈。
 * 不做任何 I/O，也不依赖随机数，便于单测。
 */
export function compare(guess: Player, target: Player): Feedback[] {
  return [
    {
      key: 'country',
      label: ATTR_LABELS.country,
      value: guess.country,
      match: guess.country === target.country ? 'correct' : 'wrong',
    },
    {
      key: 'team',
      label: ATTR_LABELS.team,
      value: guess.team,
      match: teamMatch(guess, target),
    },
    {
      key: 'role',
      label: ATTR_LABELS.role,
      value: guess.role,
      match: guess.role === target.role ? 'correct' : 'wrong',
    },
    {
      key: 'debutYear',
      label: ATTR_LABELS.debutYear,
      value: String(guess.debutYear),
      match: yearMatch(guess.debutYear, target.debutYear),
    },
    {
      key: 'worldHonor',
      label: ATTR_LABELS.worldHonor,
      value: formatHonors(guess.placements, 'S'),
      match: honorMatch(bestPlace(guess.placements, 'S'), bestPlace(target.placements, 'S')),
    },
    {
      key: 'aTierHonor',
      label: ATTR_LABELS.aTierHonor,
      value: formatHonors(guess.placements, 'A'),
      match: honorMatch(bestPlace(guess.placements, 'A'), bestPlace(target.placements, 'A')),
    },
    {
      key: 'earnings',
      label: ATTR_LABELS.earnings,
      value: formatEarnings(guess.earnings),
      match: earningsMatch(guess.earnings, target.earnings),
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
