/**
 * ModeSelectorPrefix.tsx — Dropdown selector designed to render as a prefix
 * inside a search input group (left side, shares borders with the input).
 *
 * Visual: button with current label + chevron. Click opens an absolutely
 * positioned panel listing all options. Click outside closes it.
 *
 * Styled to integrate with the search input via shared rounded-l + border-r
 * (the input wrapper provides the outer border + rounded-lg).
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useEffect, useRef, useState } from 'react'

export interface ModeOption<K extends string> {
  key: K
  label: string
}

interface Props<K extends string> {
  value: K
  onChange: (key: K) => void
  options: Array<ModeOption<K>>
  ariaLabel?: string
}

export function ModeSelectorPrefix<K extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: Props<K>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const current = options.find((o) => o.key === value) ?? options[0]!

  return (
    <div ref={containerRef} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex items-center gap-2 rounded-l-lg border-r border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors whitespace-nowrap cursor-pointer"
      >
        <span>{current.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            'size-4 transition-transform ' + (open ? 'rotate-180' : '')
          }
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg"
        >
          {options.map((opt) => {
            const active = opt.key === value
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.key)
                    setOpen(false)
                  }}
                  className={
                    'w-full px-4 py-2 text-left text-sm whitespace-nowrap transition-colors cursor-pointer ' +
                    (active
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800')
                  }
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
