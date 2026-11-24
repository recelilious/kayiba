export type Region = 'CN' | 'TW' | 'HK' | 'MO' | 'INTL'

export type Role = 'IGL' | '突破' | '支援' | '自由人'

export type LegendClass = '突击' | '游击' | '侦察' | '控制' | '支援'

export type Honor = '世界冠军' | '国际决赛' | '国内冠军' | '无'

export type Status = 'active' | 'retired' | 'streamer'

export type Tier = 1 | 2 | 3

export interface Legend {
  name: string
  class: LegendClass
}

export interface Player {
  id: string
  name: string
  cn?: string
  aliases: string[]
  search: string[]
  region: Region
  team: string
  role: Role
  legends: Legend[]
  debutYear: number
  status: Status
  honor: Honor
  tier: Tier
  verified: boolean
  notes?: string
  sources: string[]
}

export type AttrKey = 'region' | 'team' | 'role' | 'legend' | 'debutYear' | 'honor'

export type Match = 'correct' | 'close' | 'wrong'

export interface Feedback {
  key: AttrKey
  label: string
  value: string
  match: Match
  hint?: 'up' | 'down'
}

export interface Guess {
  player: Player
  feedback: Feedback[]
}
