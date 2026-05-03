import { createContext, useContext } from 'react'
import type { WishlistItem } from '../domain/wishlist'
import type { NormalizedCard } from '../domain/card'

export interface WishlistApi {
  items: WishlistItem[]
  add: (variant: NormalizedCard) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  has: (id: string) => boolean
  clear: () => void
  replaceAll: (items: WishlistItem[]) => void
  count: number
  total: number
}

export const WishlistContext = createContext<WishlistApi | null>(null)

export function useWishlist(): WishlistApi {
  const ctx = useContext(WishlistContext)
  if (!ctx) {
    throw new Error('useWishlist must be used inside WishlistProvider')
  }
  return ctx
}
