import { useMemo, useRef, useState } from 'react'
import { Tabs } from '@heroui/react'
import type { MatchResult } from '../engine/matchEngine'
import { groupByCategory, type CategoryGroup } from '../engine/matchEngine'
import { MatchedCardItem } from './MatchedCardItem'
import { useIsMobile } from '../lib/use-is-mobile'

interface Props {
  result: MatchResult
}

const SHORT_LABELS: Record<string, string> = {
  manaartifacts: 'Mana Art.',
  utilityartifacts: 'Util. Art.',
  highsynergycards: 'High Syn.',
  gamechangers: 'Decisivas',
  utilitylands: 'Util. Lands',
  planeswalkers: 'Planes.',
}

// ── Mobile chip row ────────────────────────────────────────────────────────

interface ChipRowProps {
  categories: CategoryGroup[]
  activeTab: string
  onSelect: (tag: string) => void
}

function CategoryChipRow({ categories, activeTab, onSelect }: ChipRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleSelect(tag: string) {
    onSelect(tag)
    // scroll the selected chip into view
    const el = scrollRef.current?.querySelector<HTMLButtonElement>(
      `[data-tag="${tag}"]`,
    )
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  return (
    <div className="relative -mx-4">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-4 pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        {categories.map((cat) => {
          const active = cat.tag === activeTab
          return (
            <button
              key={cat.tag}
              type="button"
              data-tag={cat.tag}
              onClick={() => handleSelect(cat.tag)}
              className={[
                'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
              ].join(' ')}
            >
              {SHORT_LABELS[cat.tag] ?? cat.header} ({cat.groups.length})
            </button>
          )
        })}
      </div>
      {/* Right fade — hints scroll */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent" />
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export function MatchResults({ result }: Props) {
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [tabSelection, setTabSelection] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const filteredGroups = useMemo(() => {
    if (maxPrice === null) return result.groups
    return result.groups.filter((g) => g.minPrice <= maxPrice)
  }, [result.groups, maxPrice])

  const categories = useMemo(
    () => groupByCategory(filteredGroups),
    [filteredGroups],
  )

  const firstTag = categories[0]?.tag ?? null
  const activeTab =
    tabSelection && categories.some((c) => c.tag === tabSelection)
      ? tabSelection
      : firstTag

  if (result.groups.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Ninguna de las {result.recommendationsCount} cartas recomendadas para
        este comandante está disponible en {result.sourcesUsed.join(', ')} en
        este momento.
      </div>
    )
  }

  const totalVariants = filteredGroups.reduce(
    (sum, g) => sum + g.variants.length,
    0,
  )

  const activeCategory = categories.find((c) => c.tag === activeTab)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {filteredGroups.length} cartas únicas · {totalVariants} variantes
          disponibles · {result.recommendationsCount} recomendadas por EDHRec ·{' '}
          {result.sourcesUsed.join(', ')}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span>Precio máx:</span>
          <input
            type="number"
            min={0}
            step={500}
            placeholder="Sin límite"
            value={maxPrice ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setMaxPrice(v === '' ? null : Number(v))
            }}
            className="w-32 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
          />
        </label>
      </div>

      {categories.length === 0 || activeTab === null ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Ninguna coincidencia dentro del rango de precio. Sube el límite o
          quítalo.
        </div>
      ) : isMobile ? (
        /* Mobile: custom compact chip row + card grid */
        <div className="flex flex-col gap-3">
          <CategoryChipRow
            categories={categories}
            activeTab={activeTab}
            onSelect={setTabSelection}
          />
          <div className="grid grid-cols-2 gap-3">
            {activeCategory?.groups.map((g) => (
              <MatchedCardItem key={g.matchKey} group={g} />
            ))}
          </div>
        </div>
      ) : (
        /* Desktop: HeroUI vertical sidebar tabs */
        <Tabs
          orientation="vertical"
          selectedKey={activeTab}
          onSelectionChange={(key) => setTabSelection(String(key))}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Categorías">
              {categories.map((cat) => (
                <Tabs.Tab key={cat.tag} id={cat.tag}>
                  {cat.header} ({cat.groups.length})
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {categories.map((cat) => (
            <Tabs.Panel key={cat.tag} id={cat.tag}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cat.groups.map((g) => (
                  <MatchedCardItem key={g.matchKey} group={g} />
                ))}
              </div>
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
    </div>
  )
}
