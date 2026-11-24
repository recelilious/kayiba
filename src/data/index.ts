import raw from './players.json'
import type { Player, Tier } from '../game/types'

export const ALL_PLAYERS = (raw.players ?? []) as unknown as Player[]

export const PLAYER_COUNT = ALL_PLAYERS.length

export function poolByTier(tier: Tier): Player[] {
  return ALL_PLAYERS.filter((p) => p.tier === tier)
}

export function tierCounts(): Record<Tier, number> {
  return {
    1: poolByTier(1).length,
    2: poolByTier(2).length,
    3: poolByTier(3).length,
  }
}
