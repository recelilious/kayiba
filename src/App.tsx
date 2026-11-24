import { useReducer } from 'react'
import { FeedbackGrid } from './components/FeedbackGrid'
import { GuessInput } from './components/GuessInput'
import { ResultCard } from './components/ResultCard'
import { ALL_PLAYERS, PLAYER_COUNT, poolByTier, tierCounts } from './data'
import { compare } from './game/feedback'
import type { Guess, Player, Tier } from './game/types'

const MAX_GUESSES = 6

type Phase = 'idle' | 'playing' | 'won' | 'lost'

interface State {
  phase: Phase
  tier: Tier
  target: Player | null
  guesses: Guess[]
  seen: string[]
}

type Action =
  | { type: 'start'; tier: Tier; target: Player }
  | { type: 'replay'; target: Player }
  | { type: 'guess'; player: Player }
  | { type: 'home' }

/** 抽取在 reducer 外完成——reducer 必须是纯函数，StrictMode 会双重调用 */
function drawTarget(pool: Player[], seen: string[]): Player {
  const fresh = pool.filter((p) => !seen.includes(p.id))
  const bag = fresh.length > 0 ? fresh : pool
  return bag[Math.floor(Math.random() * bag.length)]
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return {
        phase: 'playing',
        tier: action.tier,
        target: action.target,
        guesses: [],
        seen: [...state.seen, action.target.id],
      }
    case 'replay':
      return {
        ...state,
        phase: 'playing',
        target: action.target,
        guesses: [],
        seen: [...state.seen, action.target.id],
      }
    case 'guess': {
      if (state.phase !== 'playing' || !state.target) return state
      if (state.guesses.some((g) => g.player.id === action.player.id)) return state
      const feedback = compare(action.player, state.target)
      const guesses = [...state.guesses, { player: action.player, feedback }]
      const won = action.player.id === state.target.id
      const lost = !won && guesses.length >= MAX_GUESSES
      return { ...state, guesses, phase: won ? 'won' : lost ? 'lost' : 'playing' }
    }
    case 'home':
      return { ...state, phase: 'idle', target: null, guesses: [] }
  }
}

const TIER_LABEL: Record<Tier, string> = { 1: '简单', 2: '中等', 3: '困难' }

export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    tier: 1,
    target: null,
    guesses: [],
    seen: [],
  })

  const counts = tierCounts()
  const remaining = MAX_GUESSES - state.guesses.length
  const guessedIds = new Set(state.guesses.map((g) => g.player.id))
  const options = ALL_PLAYERS.filter((p) => !guessedIds.has(p.id))
  const inGame = state.phase !== 'idle'

  function start(tier: Tier) {
    const pool = poolByTier(tier)
    if (pool.length === 0) return
    dispatch({ type: 'start', tier, target: drawTarget(pool, state.seen) })
  }

  function replay() {
    const pool = poolByTier(state.tier)
    if (pool.length === 0) return
    dispatch({ type: 'replay', target: drawTarget(pool, state.seen) })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">APEX 猜选手</span>
        </div>
        <span className="topbar-meta">{inGame ? `剩 ${remaining} 次` : `${PLAYER_COUNT} 名选手`}</span>
      </header>

      <main className="main">
        {state.phase === 'idle' && (
          <section className="intro">
            <h1 className="intro-title">
              猜猜这位
              <br />
              APEX 选手是谁
            </h1>
            <p className="intro-sub">6 次机会。每次告诉你哪一项更接近。</p>

            <div className="tiers">
              {([1, 2, 3] as Tier[]).map((t) => (
                <button key={t} className="tier" disabled={counts[t] === 0} onClick={() => start(t)}>
                  <span className="tier-name">{TIER_LABEL[t]}</span>
                  <span className="tier-count">
                    {counts[t] === 0 ? '待补充' : `${counts[t]} 人`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {inGame && (
          <section className="board">
            <div className="board-head">
              <span className="board-tier">{TIER_LABEL[state.tier]}</span>
              <span className="board-progress">
                {state.guesses.length} / {MAX_GUESSES}
              </span>
            </div>

            <div className="guesses">
              {state.guesses.map((g, i) => (
                <article className="guess-row" key={g.player.id}>
                  <div className="guess-name">
                    <span className="guess-index">{i + 1}</span>
                    <span className="guess-id">{g.player.name}</span>
                    {g.player.cn && <span className="guess-cn">{g.player.cn}</span>}
                  </div>
                  <FeedbackGrid feedback={g.feedback} />
                </article>
              ))}
            </div>

            {state.phase === 'playing' && (
              <GuessInput options={options} onSelect={(p) => dispatch({ type: 'guess', player: p })} />
            )}

            {(state.phase === 'won' || state.phase === 'lost') && state.target && (
              <ResultCard
                target={state.target}
                won={state.phase === 'won'}
                attempts={state.guesses.length}
                onReplay={replay}
                onHome={() => dispatch({ type: 'home' })}
              />
            )}
          </section>
        )}
      </main>

      <footer className="footer">非官方粉丝作品 · 数据参考 Liquipedia · 仅供校内活动</footer>
    </div>
  )
}
