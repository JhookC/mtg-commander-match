import type { AggregateProgress } from './use-stock-catalogs'

let _current: AggregateProgress | null = null
const _listeners = new Set<() => void>()

export const catalogProgressStore = {
  get: (): AggregateProgress | null => _current,
  set: (p: AggregateProgress | null) => {
    _current = p
    for (const fn of _listeners) fn()
  },
  subscribe: (fn: () => void): (() => void) => {
    _listeners.add(fn)
    return () => {
      _listeners.delete(fn)
    }
  },
}
