import { regionLabel } from '../game/feedback'
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
          <dt>战队</dt>
          <dd>{target.team}</dd>
        </div>
        <div>
          <dt>地区</dt>
          <dd>{regionLabel(target.region)}</dd>
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
          <dt>标志传奇</dt>
          <dd>{target.legends[0]?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>最高荣誉</dt>
          <dd>{target.honor}</dd>
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
