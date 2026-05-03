/**
 * scryfall-cards.ts — Scryfall API extension for the MTG collection module.
 *
 * Provides: searchCards, getCardByExactName, getCardsByIds (batched ≤75).
 *
 * RATE LIMIT NOTE (v1 — accepted risk):
 *   No automatic queue or retry on 429. A 429 response surfaces as ScryfallNetworkError
 *   with the status code. Callers can display "rate limit reached, try again".
 *   For typical personal use (debounced search + batched /cards/collection), the
 *   Scryfall 10 req/sec limit is unlikely to be hit.
 *   A 1000-card CSV import produces ~14 sequential POST requests (~14s elapsed) — acceptable.
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import type { Card, CardImageUris, CardRelatedPart, CardPrices } from '../domain/collection'

const SCRYFALL_BASE = 'https://api.scryfall.com'

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export class ScryfallNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScryfallNotFoundError'
  }
}

export class ScryfallNetworkError extends Error {
  readonly status?: number
  readonly cause: unknown

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message)
    this.name = 'ScryfallNetworkError'
    this.status = options?.status
    this.cause = options?.cause
  }
}

// ---------------------------------------------------------------------------
// Scryfall internal response types (local — no shared dependency)
// ---------------------------------------------------------------------------

interface ScryfallImageUrisRaw {
  small?: string
  normal?: string
  large?: string
  art_crop?: string
}

interface ScryfallRelatedCardRaw {
  id: string
  name: string
  type_line: string
  component: string
  uri?: string
}

interface ScryfallCardFaceRaw {
  name: string
  image_uris?: ScryfallImageUrisRaw
}

interface ScryfallPricesRaw {
  usd?: string | null
  eur?: string | null
}

interface ScryfallCardRaw {
  id: string
  oracle_id?: string
  name: string
  set: string
  rarity: string
  type_line: string
  colors?: string[]
  color_identity: string[]
  cmc: number
  mana_cost?: string
  oracle_text?: string
  layout: string
  image_uris?: ScryfallImageUrisRaw
  card_faces?: ScryfallCardFaceRaw[]
  all_parts?: ScryfallRelatedCardRaw[]
  prices?: ScryfallPricesRaw
}

interface ScryfallListRaw<T> {
  data: T[]
  has_more?: boolean
  next_page?: string
}

interface ScryfallCollectionResponseRaw {
  data: ScryfallCardRaw[]
  not_found: ScryfallIdentifier[]
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScryfallIdentifier {
  id?: string
  name?: string
  set?: string
  collector_number?: string
}

// ---------------------------------------------------------------------------
// Mapping helper
// ---------------------------------------------------------------------------

function mapImageUris(raw?: ScryfallImageUrisRaw): CardImageUris | undefined {
  if (!raw) return undefined
  return {
    small: raw.small,
    normal: raw.normal,
    large: raw.large,
    art_crop: raw.art_crop,
  }
}

function mapRelatedPart(raw: ScryfallRelatedCardRaw): CardRelatedPart {
  const component = raw.component as CardRelatedPart['component']
  return {
    id: raw.id,
    name: raw.name,
    type_line: raw.type_line,
    component,
    uri: raw.uri,
  }
}

function mapPrices(raw?: ScryfallPricesRaw): CardPrices | undefined {
  if (!raw) return undefined
  return {
    usd: raw.usd,
    eur: raw.eur,
  }
}

/**
 * Maps a raw Scryfall API response card object to our domain Card type.
 * Extracts only the subset of fields we need; discards everything else.
 */
export function mapScryfallCard(raw: ScryfallCardRaw): Card {
  return {
    id: raw.id,
    oracle_id: raw.oracle_id,
    name: raw.name,
    set: raw.set,
    rarity: raw.rarity as Card['rarity'],
    type_line: raw.type_line,
    colors: raw.colors ?? [],
    color_identity: raw.color_identity,
    cmc: raw.cmc,
    mana_cost: raw.mana_cost,
    oracle_text: raw.oracle_text,
    layout: raw.layout,
    image_uris: mapImageUris(raw.image_uris),
    card_faces: raw.card_faces?.map((face) => ({
      name: face.name,
      image_uris: mapImageUris(face.image_uris),
    })),
    all_parts: raw.all_parts?.map(mapRelatedPart),
    prices: mapPrices(raw.prices),
    cachedAt: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Searches Scryfall by query string.
 * Returns mapped domain Cards (up to first page of results).
 * Throws ScryfallNetworkError on non-OK responses.
 */
export async function searchCards(query: string, signal?: AbortSignal): Promise<Card[]> {
  const url = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    throw new ScryfallNetworkError('Scryfall search network error', { cause: err })
  }
  if (res.status === 404) return []
  if (!res.ok) {
    throw new ScryfallNetworkError(`Scryfall search failed: ${res.status}`, { status: res.status })
  }
  const data = (await res.json()) as ScryfallListRaw<ScryfallCardRaw>
  return data.data.map(mapScryfallCard)
}

/**
 * Fetches a single card by exact name (optionally filtered by set code).
 * Throws ScryfallNotFoundError on 404, ScryfallNetworkError on other errors.
 */
export async function getCardByExactName(
  name: string,
  set?: string,
  signal?: AbortSignal,
): Promise<Card> {
  const params = new URLSearchParams({ exact: name })
  if (set) params.set('set', set)
  const url = `${SCRYFALL_BASE}/cards/named?${params.toString()}`
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    throw new ScryfallNetworkError('Scryfall named card network error', { cause: err })
  }
  if (res.status === 404) {
    throw new ScryfallNotFoundError(`Card not found: "${name}"`)
  }
  if (!res.ok) {
    throw new ScryfallNetworkError(`Scryfall named card failed: ${res.status}`, {
      status: res.status,
    })
  }
  const raw = (await res.json()) as ScryfallCardRaw
  return mapScryfallCard(raw)
}

/**
 * Fetches multiple cards by identifier batch via POST /cards/collection.
 * Automatically chunks the input into batches of ≤75 and awaits them sequentially.
 * Returns { found: Card[], not_found: ScryfallIdentifier[] }.
 */
export async function getCardsByIds(
  identifiers: ScryfallIdentifier[],
  signal?: AbortSignal,
): Promise<{ found: Card[]; not_found: ScryfallIdentifier[] }> {
  const BATCH_SIZE = 75
  const found: Card[] = []
  const not_found: ScryfallIdentifier[] = []

  for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
    const chunk = identifiers.slice(i, i + BATCH_SIZE)
    const url = `${SCRYFALL_BASE}/cards/collection`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk }),
        signal,
      })
    } catch (err) {
      throw new ScryfallNetworkError('Scryfall collection network error', { cause: err })
    }
    if (!res.ok) {
      throw new ScryfallNetworkError(`Scryfall collection failed: ${res.status}`, {
        status: res.status,
      })
    }
    const data = (await res.json()) as ScryfallCollectionResponseRaw
    found.push(...data.data.map(mapScryfallCard))
    not_found.push(...data.not_found)
  }

  return { found, not_found }
}
