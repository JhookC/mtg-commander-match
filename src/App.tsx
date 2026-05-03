/**
 * App.tsx — Top-level shell with semantic header + manual section switcher.
 *
 * Why NOT HeroUI Tabs: HeroUI v3 <Tabs> applies display:flex with row orientation
 * to its root, treating the entire wrapped subtree as a flex layout. When the shell
 * is wrapped, <header> and <main> become flex siblings sharing horizontal space —
 * <main> stops respecting max-w-7xl and collapses to share the row. The manual
 * approach below avoids this entirely with a simple state + conditional render.
 *
 * The header section switcher is a custom segmented control (role="tablist") to
 * preserve a11y semantics without dragging in a layout-imposing component.
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useState, type ComponentType } from 'react'
import { MatchView } from './components/MatchView'
import { CollectionView } from './components/CollectionView'
import { Wishlist } from './components/Wishlist'

type SectionKey = 'match' | 'collection'

const SECTIONS: Array<{ key: SectionKey; label: string; icon: ComponentType }> = [
  { key: 'match', label: 'Búsqueda', icon: SearchIcon },
  { key: 'collection', label: 'Mi colección', icon: CollectionIcon },
]

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function CollectionIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function App() {
  const [section, setSection] = useState<SectionKey>('match')

  return (
    <div className="min-h-svh bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6 py-3">
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              MTG Commander Match
            </h1>
            <nav
              role="tablist"
              aria-label="Secciones principales"
              className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5 w-fit"
            >
              {SECTIONS.map(({ key, label, icon: Icon }) => {
                const active = section === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSection(key)}
                    className={
                      'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ' +
                      (active
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100')
                    }
                  >
                    <Icon />
                    {label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {section === 'match' && <MatchView />}
        {section === 'collection' && <CollectionView />}
      </main>

      {/* Wishlist floating button — cross-section, always visible */}
      <Wishlist />
    </div>
  )
}

export default App
