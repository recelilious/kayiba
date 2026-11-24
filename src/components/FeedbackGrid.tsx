import type { Feedback } from '../game/types'

const ICON = { correct: '✓', close: '≈', wrong: '✕' } as const

export function FeedbackGrid({ feedback }: { feedback: Feedback[] }) {
  return (
    <div className="fb-grid">
      {feedback.map((f) => (
        <div key={f.key} className={`fb-cell fb-${f.match} fb-key-${f.key}`}>
          <span className="fb-label">{f.label}</span>
          <span className="fb-value">{f.value}</span>
          <span className="fb-icon" aria-hidden="true">
            {ICON[f.match]}
          </span>
        </div>
      ))}
    </div>
  )
}
