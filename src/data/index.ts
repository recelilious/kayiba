import raw from './players.json'
import type { Player, Tier } from '../game/types'

export const ALL_PLAYERS = (raw.players ?? []) as unknown as Player[]

export const PLAYER_COUNT = ALL_PLAYERS.length

/**
 * 难度 = 池子大小，不是互斥分组：
 * 简单只抽 1 档，中等抽 1–2 档，困难抽全部。
 * 所以困难档里也可能抽到简单档的选手。
 */
export function poolForDifficulty(tier: Tier): Player[] {
  return ALL_PLAYERS.filter((p) => p.tier <= tier)
}

export function difficultyCounts(): Record<Tier, number> {
  return {
    1: ALL_PLAYERS.filter((p) => p.tier <= 1).length,
    2: ALL_PLAYERS.filter((p) => p.tier <= 2).length,
    3: ALL_PLAYERS.length,
  }
}
