import type { Commander, CommanderSuggestion } from '../domain/commander'

const SCRYFALL_BASE = 'https://api.scryfall.com'

interface ScryfallList<T> {
  data: T[]
}

interface ScryfallImageUris {
  small?: string
  normal?: string
  large?: string
  art_crop?: string
}

interface ScryfallFace {
  image_uris?: ScryfallImageUris
  mana_cost?: string
  oracle_text?: string
  type_line?: string
}

interface ScryfallCard {
  oracle_id: string
  name: string
  color_identity: string[]
  type_line: string
  mana_cost?: string
  cmc?: number
  oracle_text?: string
  edhrec_rank?: number
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallFace[]
}

function pickArtCrop(card: ScryfallCard): string | null {
  return (
    card.image_uris?.art_crop ??
    card.card_faces?.[0]?.image_uris?.art_crop ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.small ??
    null
  )
}

export async function searchCommanders(
  query: string,
  signal?: AbortSignal,
): Promise<CommanderSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const q = `is:commander ${trimmed}`
  const url = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=edhrec`
  const res = await fetch(url, { signal })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Scryfall search failed: ${res.status}`)
  const data = (await res.json()) as ScryfallList<ScryfallCard>
  return data.data.slice(0, 20).map((c) => ({
    name: c.name,
    slug: toEdhrecSlug(c.name),
    artUrl: pickArtCrop(c),
  }))
}

export async function resolveCommander(
  name: string,
  signal?: AbortSignal,
): Promise<Commander> {
  const url = `${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(name)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Scryfall resolve failed: ${res.status}`)
  const c = (await res.json()) as ScryfallCard
  const imageUrl =
    c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null
  const artCropUrl = pickArtCrop(c)
  const front = c.card_faces?.[0]
  const manaCost = c.mana_cost ?? front?.mana_cost ?? null
  const oracleText = c.oracle_text ?? front?.oracle_text ?? null
  return {
    oracleId: c.oracle_id,
    name: c.name,
    slug: toEdhrecSlug(c.name),
    colorIdentity: c.color_identity,
    imageUrl,
    artCropUrl,
    typeLine: c.type_line,
    manaCost: manaCost && manaCost.length > 0 ? manaCost : null,
    cmc: c.cmc ?? null,
    oracleText: oracleText && oracleText.length > 0 ? oracleText : null,
    edhrecRank: c.edhrec_rank ?? null,
  }
}

/**
 * EDHRec slug. For split/DFC commanders, EDHRec keys on the first face only
 * (e.g. "Tovolar, Dire Overlord // ..." → "tovolar-dire-overlord").
 */
export function toEdhrecSlug(name: string): string {
  const front = name.split(' // ')[0] ?? name
  return front
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
