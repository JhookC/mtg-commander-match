import { toMatchKey } from '../domain/card'

const EDHREC_BASE = 'https://json.edhrec.com/pages/commanders'

/**
 * Categories that aggregate across types (top cards, high synergy, etc.).
 * We deprioritize them when assigning a card's primary category, but keep
 * them visible as a flag.
 */
const META_TAGS = new Set([
  'newcards',
  'highsynergycards',
  'topcards',
  'gamechangers',
])

export interface Recommendation {
  matchKey: string
  name: string
  category: string
  categoryHeader: string
  synergy: number
  inclusion: number
  numDecks: number
  potentialDecks: number
  inclusionRate: number
  isHighSynergy: boolean
  isTopCard: boolean
  isGameChanger: boolean
}

interface EdhrecCardview {
  name: string
  synergy?: number
  inclusion?: number
  num_decks?: number
  potential_decks?: number
}

interface EdhrecCardlist {
  tag: string
  header: string
  cardviews: EdhrecCardview[]
}

interface EdhrecResponse {
  container: {
    json_dict: {
      cardlists: EdhrecCardlist[]
    }
  }
}

export async function fetchRecommendations(
  slug: string,
  signal?: AbortSignal,
): Promise<Recommendation[]> {
  const url = `${EDHREC_BASE}/${slug}.json`
  const res = await fetch(url, { signal })
  if (res.status === 404) {
    throw new Error(`Commander not found on EDHRec: ${slug}`)
  }
  if (!res.ok) throw new Error(`EDHRec fetch failed: ${res.status}`)
  const data = (await res.json()) as EdhrecResponse

  const byKey = new Map<string, Recommendation>()
  const lists = data.container.json_dict.cardlists ?? []

  for (const list of lists) {
    const isMetaList = META_TAGS.has(list.tag)
    for (const cv of list.cardviews ?? []) {
      const key = toMatchKey(cv.name)
      const existing = byKey.get(key)
      const numDecks = cv.num_decks ?? 0
      const potentialDecks = cv.potential_decks ?? 0
      const rec: Recommendation =
        existing ??
        {
          matchKey: key,
          name: cv.name,
          category: list.tag,
          categoryHeader: list.header,
          synergy: cv.synergy ?? 0,
          inclusion: cv.inclusion ?? 0,
          numDecks,
          potentialDecks,
          inclusionRate: potentialDecks > 0 ? numDecks / potentialDecks : 0,
          isHighSynergy: false,
          isTopCard: false,
          isGameChanger: false,
        }

      if (list.tag === 'highsynergycards') rec.isHighSynergy = true
      if (list.tag === 'topcards') rec.isTopCard = true
      if (list.tag === 'gamechangers') rec.isGameChanger = true

      // Promote to a non-meta category if we previously stored a meta one.
      if (existing && !isMetaList && META_TAGS.has(existing.category)) {
        rec.category = list.tag
        rec.categoryHeader = list.header
      }

      byKey.set(key, rec)
    }
  }

  return Array.from(byKey.values())
}
