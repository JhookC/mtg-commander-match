import { createContext, useContext } from 'react'

export const PreviewContext = createContext<
  ((url: string | null) => void) | null
>(null)

export function useImagePreview() {
  const ctx = useContext(PreviewContext)
  if (!ctx) {
    throw new Error('useImagePreview must be used inside PreviewProvider')
  }
  return ctx
}
