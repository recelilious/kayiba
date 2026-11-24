import type { Feedback } from '../game/types'

const ICON = { correct: '✓', close: '≈', wrong: '✕' } as const
const ARROW = { up: '↑', down: '↓' } as const

export function FeedbackGrid({ feedback }: { feedback: Feedback[] }) {
  return (
    <div className="fb-grid">
      {feedback.map((f) => (
        <div key={f.key} className={`fb-cell fb-${f.match}`}>
          <span className="fb-label">{f.label}</span>
          <span className="fb-value">
            {f.value}
            {f.hint && <span className="fb-arrow">{ARROW[f.hint]}</span>}
          </span>
          <span className="fb-icon" aria-hidden="true">
            {ICON[f.match]}
          </span>
        </div>
      ))}
    </div>
  )
}
