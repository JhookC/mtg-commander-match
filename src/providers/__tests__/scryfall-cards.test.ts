/**
 * scryfall-cards.test.ts — Tests for the Scryfall collection API extension.
 *
 * Uses vi.spyOn(global, 'fetch') for mocking — no real HTTP requests.
 * NEVER calls vi.useFakeTimers() in this file (no Dexie, but keep convention consistent).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  searchCards,
  getCardByExactName,
  getCardsByIds,
  ScryfallNotFoundError,
  ScryfallNetworkError,
} from '../scryfall-cards'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScryfallCardRaw(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'card-uuid-1',
    oracle_id: 'oracle-uuid-1',
    name: 'Sol Ring',
    set: 'cmr',
    rarity: 'uncommon',
    type_line: 'Artifact',
    colors: [],
    color_identity: [],
    cmc: 1,
    mana_cost: '{1}',
    oracle_text: '{T}: Add {C}{C}.',
    layout: 'normal',
    image_uris: {
      small: 'https://cards.scryfall.io/small/front/sol-ring.jpg',
      normal: 'https://cards.scryfall.io/normal/front/sol-ring.jpg',
      large: 'https://cards.scryfall.io/large/front/sol-ring.jpg',
      art_crop: 'https://cards.scryfall.io/art_crop/front/sol-ring.jpg',
    },
    all_parts: null,
    prices: { usd: '1.50', eur: '1.20' },
    ...overrides,
  }
}

function mockFetchOk(body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
}

function mockFetchStatus(status: number) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ object: 'error', code: 'not_found' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// searchCards
// ---------------------------------------------------------------------------

describe('searchCards', () => {
  it('returns mapped cards on successful response', async () => {
    const rawCard = makeScryfallCardRaw()
    mockFetchOk({ data: [rawCard] })

    const results = await searchCards('Sol Ring')

    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('card-uuid-1')
    expect(results[0]!.name).toBe('Sol Ring')
    expect(results[0]!.set).toBe('cmr')
    expect(results[0]!.rarity).toBe('uncommon')
    expect(results[0]!.prices?.usd).toBe('1.50')
    // cachedAt should be set
    expect(results[0]!.cachedAt).toBeGreaterThan(0)
  })

  it('returns empty array on 404', async () => {
    mockFetchStatus(404)
    const results = await searchCards('xyzzy-fake-card')
    expect(results).toEqual([])
  })

  it('throws ScryfallNetworkError on non-OK response', async () => {
    mockFetchStatus(500)
    await expect(searchCards('Sol Ring')).rejects.toBeInstanceOf(ScryfallNetworkError)
  })

  it('throws ScryfallNetworkError on fetch failure (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(searchCards('Sol Ring')).rejects.toBeInstanceOf(ScryfallNetworkError)
  })

  it('maps multiple cards correctly', async () => {
    const rawCards = [
      makeScryfallCardRaw({ id: 'id-1', name: 'Sol Ring' }),
      makeScryfallCardRaw({ id: 'id-2', name: 'Black Lotus' }),
    ]
    mockFetchOk({ data: rawCards })

    const results = await searchCards('sol')
    expect(results).toHaveLength(2)
    expect(results[0]!.id).toBe('id-1')
    expect(results[1]!.id).toBe('id-2')
  })

  it('maps card_faces when present (DFC cards)', async () => {
    const rawCard = makeScryfallCardRaw({
      layout: 'transform',
      image_uris: undefined,
      card_faces: [
        { name: 'Front Face', image_uris: { normal: 'https://example.com/front.jpg' } },
        { name: 'Back Face', image_uris: { normal: 'https://example.com/back.jpg' } },
      ],
    })
    mockFetchOk({ data: [rawCard] })

    const results = await searchCards('Transform Card')
    expect(results[0]!.card_faces).toHaveLength(2)
    expect(results[0]!.card_faces![0]!.name).toBe('Front Face')
  })
})

// ---------------------------------------------------------------------------
// getCardByExactName
// ---------------------------------------------------------------------------

describe('getCardByExactName', () => {
  it('returns a single mapped card on success', async () => {
    const rawCard = makeScryfallCardRaw()
    mockFetchOk(rawCard)

    const card = await getCardByExactName('Sol Ring')
    expect(card.id).toBe('card-uuid-1')
    expect(card.name).toBe('Sol Ring')
  })

  it('includes set param in the URL when provided', async () => {
    const rawCard = makeScryfallCardRaw({ set: 'lea' })
    const spy = mockFetchOk(rawCard)

    await getCardByExactName('Sol Ring', 'lea')

    const calledUrl = (spy.mock.calls[0]![0] as string)
    expect(calledUrl).toContain('set=lea')
    expect(calledUrl).toContain('exact=Sol+Ring')
  })

  it('throws ScryfallNotFoundError on 404', async () => {
    mockFetchStatus(404)
    await expect(getCardByExactName('Fake Card')).rejects.toBeInstanceOf(ScryfallNotFoundError)
  })

  it('throws ScryfallNetworkError on 500', async () => {
    mockFetchStatus(500)
    await expect(getCardByExactName('Sol Ring')).rejects.toBeInstanceOf(ScryfallNetworkError)
  })

  it('throws ScryfallNetworkError on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Network error'))
    await expect(getCardByExactName('Sol Ring')).rejects.toBeInstanceOf(ScryfallNetworkError)
  })
})

// ---------------------------------------------------------------------------
// getCardsByIds
// ---------------------------------------------------------------------------

describe('getCardsByIds', () => {
  it('returns found cards and not_found identifiers', async () => {
    const rawCard = makeScryfallCardRaw()
    const notFound = [{ name: 'Fake Card' }]
    mockFetchOk({ data: [rawCard], not_found: notFound })

    const result = await getCardsByIds([{ id: 'card-uuid-1' }, { name: 'Fake Card' }])

    expect(result.found).toHaveLength(1)
    expect(result.found[0]!.id).toBe('card-uuid-1')
    expect(result.not_found).toHaveLength(1)
    expect(result.not_found[0]!.name).toBe('Fake Card')
  })

  it('returns empty arrays for empty input', async () => {
    const result = await getCardsByIds([])
    expect(result.found).toEqual([])
    expect(result.not_found).toEqual([])
  })

  it('chunks correctly: >75 identifiers make multiple POST requests', async () => {
    // Build 80 identifiers
    const identifiers = Array.from({ length: 80 }, (_, i) => ({ name: `Card ${i}` }))

    const spy = vi.spyOn(globalThis, 'fetch')

    // First batch (75 items): returns 75 found cards
    const batch1Cards = Array.from({ length: 75 }, (_, i) =>
      makeScryfallCardRaw({ id: `id-${i}`, name: `Card ${i}` }),
    )
    spy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: batch1Cards, not_found: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    // Second batch (5 items): returns 5 found cards
    const batch2Cards = Array.from({ length: 5 }, (_, i) =>
      makeScryfallCardRaw({ id: `id-${75 + i}`, name: `Card ${75 + i}` }),
    )
    spy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: batch2Cards, not_found: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await getCardsByIds(identifiers)

    // Exactly 2 POST requests made
    expect(spy).toHaveBeenCalledTimes(2)

    // First batch had 75 identifiers
    const firstCall = spy.mock.calls[0]
    const firstBody = JSON.parse(firstCall![1]!.body as string) as { identifiers: unknown[] }
    expect(firstBody.identifiers).toHaveLength(75)

    // Second batch had 5 identifiers
    const secondCall = spy.mock.calls[1]
    const secondBody = JSON.parse(secondCall![1]!.body as string) as { identifiers: unknown[] }
    expect(secondBody.identifiers).toHaveLength(5)

    // Total found cards
    expect(result.found).toHaveLength(80)
    expect(result.not_found).toHaveLength(0)
  })

  it('correctly handles exactly 75 identifiers in one request', async () => {
    const identifiers = Array.from({ length: 75 }, (_, i) => ({ name: `Card ${i}` }))
    const spy = vi.spyOn(globalThis, 'fetch')

    const batchCards = Array.from({ length: 75 }, (_, i) =>
      makeScryfallCardRaw({ id: `id-${i}`, name: `Card ${i}` }),
    )
    spy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: batchCards, not_found: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await getCardsByIds(identifiers)

    // Exactly 1 request for exactly 75 items
    expect(spy).toHaveBeenCalledTimes(1)
    expect(result.found).toHaveLength(75)
  })

  it('throws ScryfallNetworkError on non-OK response', async () => {
    const identifiers = [{ id: 'some-id' }]
    mockFetchStatus(500)
    await expect(getCardsByIds(identifiers)).rejects.toBeInstanceOf(ScryfallNetworkError)
  })

  it('concatenates results from multiple batches including not_found', async () => {
    const identifiers = Array.from({ length: 80 }, (_, i) => ({ name: `Card ${i}` }))
    const spy = vi.spyOn(globalThis, 'fetch')

    // First batch: 74 found, 1 not_found
    const batch1Cards = Array.from({ length: 74 }, (_, i) =>
      makeScryfallCardRaw({ id: `id-${i}`, name: `Card ${i}` }),
    )
    spy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: batch1Cards, not_found: [{ name: 'Card 74' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    // Second batch: 4 found, 1 not_found
    const batch2Cards = Array.from({ length: 4 }, (_, i) =>
      makeScryfallCardRaw({ id: `id-${75 + i}`, name: `Card ${75 + i}` }),
    )
    spy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: batch2Cards, not_found: [{ name: 'Card 79' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await getCardsByIds(identifiers)
    expect(result.found).toHaveLength(78)
    expect(result.not_found).toHaveLength(2)
  })
})
