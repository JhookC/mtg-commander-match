import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PreviewContext } from './preview-context'

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null)
  const close = useCallback(() => setUrl(null), [])

  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [url, close])

  return (
    <PreviewContext.Provider value={setUrl}>
      {children}
      {url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de carta"
        >
          <img
            src={url}
            alt=""
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </PreviewContext.Provider>
  )
}
