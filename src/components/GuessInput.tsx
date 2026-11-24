import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { matchesQuery, nicknameOf } from '../game/feedback'
import type { Player } from '../game/types'

interface Props {
  options: Player[]
  disabled?: boolean
  onSelect: (player: Player) => void
}

const MAX_OPTIONS = 8

export function GuessInput({ options, disabled, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const filtered = useMemo(
    () => options.filter((p) => matchesQuery(p, query)).slice(0, MAX_OPTIONS),
    [options, query],
  )

  useEffect(() => {
    setActive(0)
  }, [query, open])

  function choose(player: Player) {
    onSelect(player)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = filtered[active]
      if (picked) choose(picked)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="guess-input">
      <input
        ref={inputRef}
        className="guess-field"
        type="text"
        value={query}
        disabled={disabled}
        placeholder="输入选手 ID / 中文名 / 拼音"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul className="options" id={listId} role="listbox">
          {filtered.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'option is-active' : 'option'}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(p)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="option-name">{p.name}</span>
              <span className="option-cn">{nicknameOf(p)}</span>
              <span className="option-team">{p.team}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
