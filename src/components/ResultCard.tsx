import { formatEarnings, formatHonors } from '../game/feedback'
import type { Player } from '../game/types'

interface Props {
  target: Player
  won: boolean
  attempts: number
  onReplay: () => void
  onHome: () => void
}

export function ResultCard({ target, won, attempts, onReplay, onHome }: Props) {
  return (
    <div className="result">
      <div className={won ? 'result-badge is-win' : 'result-badge'}>
        {won ? `猜中了 · ${attempts} 次` : '机会用完了'}
      </div>

      <h2 className="result-name">
        {target.name}
        {target.cn && <span className="result-cn">{target.cn}</span>}
      </h2>

      <dl className="result-facts">
        <div>
          <dt>地区</dt>
          <dd>{target.country}</dd>
        </div>
        <div>
          <dt>当前战队</dt>
          <dd>{target.team}</dd>
        </div>
        <div>
          <dt>位置</dt>
          <dd>{target.role}</dd>
        </div>
        <div>
          <dt>出道</dt>
          <dd>{target.debutYear}</dd>
        </div>
        <div>
          <dt>世界赛</dt>
          <dd>{formatHonors(target.placements, 'S')}</dd>
        </div>
        <div>
          <dt>A 级赛事</dt>
          <dd>{formatHonors(target.placements, 'A')}</dd>
        </div>
        <div>
          <dt>生涯奖金</dt>
          <dd>{formatEarnings(target.earnings)}</dd>
        </div>
      </dl>

      <div className="result-actions">
        <button className="btn-primary" onClick={onReplay}>
          再来一局
        </button>
        <button className="btn-ghost" onClick={onHome}>
          换个难度
        </button>
      </div>
    </div>
  )
}
