import { useMemo, useState } from 'react'
import { Tabs } from '@heroui/react'
import type { MatchResult } from '../engine/matchEngine'
import { groupByCategory } from '../engine/matchEngine'
import { MatchedCardItem } from './MatchedCardItem'

interface Props {
  result: MatchResult
}

export function MatchResults({ result }: Props) {
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [tabSelection, setTabSelection] = useState<string | null>(null)

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
      ) : (
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
