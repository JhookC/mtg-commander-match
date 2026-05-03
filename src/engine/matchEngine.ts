import { fetchRecommendations } from '../providers/edhrec'
import { sources } from '../sources/registry'
import type { MatchedCardGroup, NormalizedCard } from '../domain/card'
import { toMatchKey } from '../domain/card'

export interface MatchResult {
  groups: MatchedCardGroup[]
  recommendationsCount: number
  stockCount: number
  sourcesUsed: string[]
}

export interface CategoryGroup {
  tag: string
  header: string
  groups: MatchedCardGroup[]
}

/**
 * Display priority. Categories higher in this list show up first as tabs and
 * the first one with content becomes the default tab. Lands sit at the bottom
 * because basic lands are noise — the user usually wants to see Creatures,
 * Instants, etc. first.
 */
const CATEGORY_PRIORITY: string[] = [
  'creatures',
  'planeswalkers',
  'instants',
  'sorceries',
  'artifacts',
  'enchantments',
  'manaartifacts',
  'utilityartifacts',
  'newcards',
  'topcards',
  'highsynergycards',
  'gamechangers',
  'utilitylands',
  'lands',
]

export async function findMatches(
  commanderSlug: string,
  signal?: AbortSignal,
): Promise<MatchResult> {
  const [recs, ...stockResults] = await Promise.all([
    fetchRecommendations(commanderSlug, signal),
    ...sources.map((s) => s.fetchInStock(signal)),
  ])

  const stockByKey = new Map<string, NormalizedCard[]>()
  let stockCount = 0
  for (const result of stockResults) {
    for (const card of result) {
      stockCount++
      const list = stockByKey.get(card.matchKey)
      if (list) list.push(card)
      else stockByKey.set(card.matchKey, [card])
    }
  }

  const groups: MatchedCardGroup[] = []
  for (const rec of recs) {
    const variants = stockByKey.get(rec.matchKey)
    if (!variants || variants.length === 0) continue
    const deduped = collapseVariants(variants)
    const sorted = deduped.sort((a, b) => a.price - b.price)
    const cheapest = sorted[0]!
    const totalStock = sorted.reduce((sum, v) => sum + v.stock, 0)
    const sourceSet = new Set<string>()
    for (const v of sorted) sourceSet.add(v.sourceName)
    groups.push({
      matchKey: rec.matchKey,
      displayName: cheapest.displayName,
      category: rec.category,
      categoryHeader: rec.categoryHeader,
      synergy: rec.synergy,
      inclusion: rec.inclusion,
      numDecks: rec.numDecks,
      potentialDecks: rec.potentialDecks,
      inclusionRate: rec.inclusionRate,
      isHighSynergy: rec.isHighSynergy,
      isTopCard: rec.isTopCard,
      isGameChanger: rec.isGameChanger,
      variants: sorted,
      primaryVariant: cheapest,
      minPrice: cheapest.price,
      totalStock,
      currency: cheapest.currency,
      availableSources: Array.from(sourceSet),
    })
  }

  return {
    groups,
    recommendationsCount: recs.length,
    stockCount,
    sourcesUsed: sources.map((s) => s.name),
  }
}

export interface CardLookupResult {
  /** null when nothing in stock for this card across all sources. */
  group: MatchedCardGroup | null
  sourcesUsed: string[]
}

/**
 * Looks up a single card by name across all stock sources (no EDHrec involved).
 * Used by the "Carta específica" search mode.
 *
 * Synergy/inclusion/etc fields on the returned MatchedCardGroup are zeroed —
 * they are EDHrec-specific and don't apply to a direct card lookup, but the
 * group shape is reused so MatchResults / MatchedCardItem render unchanged.
 */
export async function findCardInStock(
  cardName: string,
  signal?: AbortSignal,
): Promise<CardLookupResult> {
  const targetKey = toMatchKey(cardName)
  const stockResults = await Promise.all(
    sources.map((s) => s.fetchInStock(signal)),
  )

  const variants: NormalizedCard[] = []
  for (const result of stockResults) {
    for (const card of result) {
      if (card.matchKey === targetKey) variants.push(card)
    }
  }

  const sourcesUsed = sources.map((s) => s.name)

  if (variants.length === 0) {
    return { group: null, sourcesUsed }
  }

  const deduped = collapseVariants(variants)
  const sorted = deduped.sort((a, b) => a.price - b.price)
  const cheapest = sorted[0]!
  const totalStock = sorted.reduce((sum, v) => sum + v.stock, 0)
  const sourceSet = new Set<string>()
  for (const v of sorted) sourceSet.add(v.sourceName)

  const group: MatchedCardGroup = {
    matchKey: targetKey,
    displayName: cheapest.displayName,
    category: 'lookup',
    categoryHeader: 'Resultado',
    synergy: 0,
    inclusion: 0,
    numDecks: 0,
    potentialDecks: 0,
    inclusionRate: 0,
    isHighSynergy: false,
    isTopCard: false,
    isGameChanger: false,
    variants: sorted,
    primaryVariant: cheapest,
    minPrice: cheapest.price,
    totalStock,
    currency: cheapest.currency,
    availableSources: Array.from(sourceSet),
  }

  return { group, sourcesUsed }
}

/**
 * A single source can list the same physical SKU multiple times (different
 * stock lots, internal ids, etc.). Collapse them into one row per real variant
 * by summing stock and keeping the cheapest price.
 */
function collapseVariants(variants: NormalizedCard[]): NormalizedCard[] {
  const byKey = new Map<string, NormalizedCard>()
  for (const v of variants) {
    const key = `${v.sourceName}|${v.setCode}|${v.collectorNumber}|${v.finish}|${v.condition}|${v.language}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...v })
      continue
    }
    existing.stock += v.stock
    if (v.price < existing.price) {
      existing.price = v.price
      existing.sourceId = v.sourceId
      if (v.imageUrl) existing.imageUrl = v.imageUrl
    }
  }
  return Array.from(byKey.values())
}

export function groupByCategory(groups: MatchedCardGroup[]): CategoryGroup[] {
  const byTag = new Map<string, CategoryGroup>()
  for (const g of groups) {
    const existing = byTag.get(g.category)
    if (existing) {
      existing.groups.push(g)
    } else {
      byTag.set(g.category, {
        tag: g.category,
        header: g.categoryHeader,
        groups: [g],
      })
    }
  }
  for (const cat of byTag.values()) {
    cat.groups.sort((a, b) => {
      if (b.inclusionRate !== a.inclusionRate) {
        return b.inclusionRate - a.inclusionRate
      }
      return a.minPrice - b.minPrice
    })
  }
  return Array.from(byTag.values()).sort((a, b) => {
    const ai = CATEGORY_PRIORITY.indexOf(a.tag)
    const bi = CATEGORY_PRIORITY.indexOf(b.tag)
    const aRank = ai === -1 ? 999 : ai
    const bRank = bi === -1 ? 999 : bi
    if (aRank !== bRank) return aRank - bRank
    return b.groups.length - a.groups.length
  })
}
