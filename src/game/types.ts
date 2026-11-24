/** 位置简化为两档：指挥（IGL）与输出 */
export type Role = '指挥' | '输出'

export type Status = 'active' | 'retired' | 'streamer'

export type Tier = 1 | 2 | 3

/** Liquipedia 的赛事分级：S 级算世界赛，A 级算 A 级赛事 */
export type EventTier = 'S' | 'A'

export interface Placement {
  /** YYYY-MM-DD */
  date: string
  /** 名次，只保留 10 名以内 */
  place: number
  tier: EventTier
  event: string
}

export interface Player {
  id: string
  name: string
  cn?: string
  aliases: string[]
  search: string[]
  /** 中文国名。中国大陆、港澳台统一为「中国」 */
  country: string
  /** 当前战队 */
  team: string
  /** 曾经待过、现在不在的战队 */
  teamHistory: string[]
  role: Role
  debutYear: number
  status: Status
  /** 只包含 S / A 级、10 名以内的战绩 */
  placements: Placement[]
  /** 生涯奖金，美元 */
  earnings: number
  tier: Tier
  verified: boolean
  notes?: string
  sources: string[]
}

export type AttrKey =
  | 'country'
  | 'team'
  | 'status'
  | 'debutYear'
  | 'worldHonor'
  | 'aTierHonor'
  | 'earnings'

export type Match = 'correct' | 'close' | 'wrong'

export interface Feedback {
  key: AttrKey
  label: string
  value: string
  match: Match
}

export interface Guess {
  player: Player
  feedback: Feedback[]
}
