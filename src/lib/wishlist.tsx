import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { NormalizedCard } from '../domain/card'
import type { WishlistItem } from '../domain/wishlist'
import { fromVariant, variantId } from '../domain/wishlist'
import { WishlistContext } from './wishlist-context'

const STORAGE_KEY = 'mtg-match-wishlist-v1'

function loadInitial(): WishlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WishlistItem[]) : []
  } catch {
    return []
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>(loadInitial)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const add = useCallback((variant: NormalizedCard) => {
    const id = variantId(variant)
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id)
      if (idx === -1) return [...prev, fromVariant(variant, 1)]
      const next = [...prev]
      next[idx] = { ...next[idx]!, qty: next[idx]!.qty + 1 }
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((it) => it.id !== id)
      return prev.map((it) => (it.id === id ? { ...it, qty } : it))
    })
  }, [])

  const has = useCallback(
    (id: string) => items.some((it) => it.id === id),
    [items],
  )

  const clear = useCallback(() => setItems([]), [])

  const replaceAll = useCallback((next: WishlistItem[]) => {
    setItems(next)
  }, [])

  const count = useMemo(
    () => items.reduce((sum, it) => sum + it.qty, 0),
    [items],
  )
  const total = useMemo(
    () => items.reduce((sum, it) => sum + it.price * it.qty, 0),
    [items],
  )

  const api = useMemo(
    () => ({
      items,
      add,
      remove,
      setQty,
      has,
      clear,
      replaceAll,
      count,
      total,
    }),
    [items, add, remove, setQty, has, clear, replaceAll, count, total],
  )

  return (
    <WishlistContext.Provider value={api}>{children}</WishlistContext.Provider>
  )
}
