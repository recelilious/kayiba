import { useReducer } from 'react'
import { FeedbackGrid } from './components/FeedbackGrid'
import { GuessInput } from './components/GuessInput'
import { ResultCard } from './components/ResultCard'
import { ALL_PLAYERS, PLAYER_COUNT, difficultyCounts, poolForDifficulty } from './data'
import { compare, nicknameOf } from './game/feedback'
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

const TIER_DESC: Record<Tier, string> = {
  1: '只有国内选手 · ALGS 世界赛、EWC、星空杯冠军级，全国知名',
  2: '一线职业选手与头部主播，常看比赛就认识',
  3: '边缘现役、退役老将，以及国际顶尖选手',
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    tier: 1,
    target: null,
    guesses: [],
    seen: [],
  })

  const counts = difficultyCounts()
  const remaining = MAX_GUESSES - state.guesses.length
  const guessedIds = new Set(state.guesses.map((g) => g.player.id))
  const options = ALL_PLAYERS.filter((p) => !guessedIds.has(p.id))
  const inGame = state.phase !== 'idle'

  function start(tier: Tier) {
    const pool = poolForDifficulty(tier)
    if (pool.length === 0) return
    dispatch({ type: 'start', tier, target: drawTarget(pool, state.seen) })
  }

  function replay() {
    const pool = poolForDifficulty(state.tier)
    if (pool.length === 0) return
    dispatch({ type: 'replay', target: drawTarget(pool, state.seen) })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">卡一把</span>
        </div>
        <span className="topbar-meta">{inGame ? `剩 ${remaining} 次` : `${PLAYER_COUNT} 名选手`}</span>
      </header>

      <main className="main">
        {state.phase === 'idle' && (
          <section className="intro">
            <h1 className="intro-title">卡一把</h1>
            <p className="intro-sub">猜猜这位 APEX 选手是谁。6 次机会，每次告诉你哪一项更接近。</p>

            <div className="tiers">
              {([1, 2, 3] as Tier[]).map((t) => (
                <button key={t} className="tier" disabled={counts[t] === 0} onClick={() => start(t)}>
                  <span className="tier-head">
                    <span className="tier-name">{TIER_LABEL[t]}</span>
                    <span className="tier-count">{counts[t] === 0 ? '待补充' : `${counts[t]} 人`}</span>
                  </span>
                  <span className="tier-desc">{TIER_DESC[t]}</span>
                </button>
              ))}
            </div>

            <section className="rules">
              <h2 className="rules-title">怎么玩</h2>
              <p className="rules-lead">
                每次猜一位选手，最多 6 次机会。每猜一次，系统按七项属性给出颜色提示，帮你缩小范围。
              </p>

              <ul className="rules-legend">
                <li>
                  <span className="dot dot-correct" aria-hidden="true" />
                  绿色：完全一致
                </li>
                <li>
                  <span className="dot dot-close" aria-hidden="true" />
                  橙色：接近
                </li>
                <li>
                  <span className="dot dot-wrong" aria-hidden="true" />
                  灰色：不符
                </li>
              </ul>

              <h3 className="rules-sub">七项属性的判定</h3>
              <dl className="rules-list">
                <div>
                  <dt>地区</dt>
                  <dd>
                    国家和答案相同判绿。中国选手（含港澳台）统一算「中国」，其余按国名。这一项没有橙色。
                  </dd>
                </div>
                <div>
                  <dt>战队</dt>
                  <dd>
                    当前战队相同判绿；<strong>若你猜的选手当前战队，是答案选手待过、但现在已经离开的战队（或反过来），判橙</strong>。
                  </dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>现役 / 退役与答案相同判绿。这一项没有橙色。</dd>
                </div>
                <div>
                  <dt>出道</dt>
                  <dd>出道年份相同判绿；相差 2 年以内判橙。</dd>
                </div>
                <div>
                  <dt>世界赛</dt>
                  <dd>
                    显示该选手在 S 级赛事拿过的名次，按名次从好到差排列，例如 <code>#1 #3 #9</code>。比对时只取其中
                    <strong>最好的名次</strong>：相同判绿，相差 2 名以内判橙。双方都没有名次时判绿。
                  </dd>
                </div>
                <div>
                  <dt>A 级赛</dt>
                  <dd>规则同「世界赛」，统计范围换成 A 级赛事。</dd>
                </div>
                <div>
                  <dt>奖金</dt>
                  <dd>生涯奖金总额完全相同判绿；相差 2 倍以内判橙。</dd>
                </div>
              </dl>

              <h3 className="rules-sub">难度与出题池</h3>
              <p className="rules-lead">
                难度只决定出题池的大小。简单档只从国内知名选手出题；中等、困难依次把更多选手纳入池子，
                所以困难档也可能抽到简单档的选手。同一档内每次随机出题，同一局里不会重复。
              </p>
            </section>
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
                    <span className="guess-cn">{nicknameOf(g.player)}</span>
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
