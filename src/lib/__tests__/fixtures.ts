/**
 * fixtures.ts — Sample domain objects for engine + IO tests.
 *
 * These are plain TS objects — no Dexie, no React, no side effects.
 * Import and spread-override as needed in tests.
 */

import type { Card, CollectionEntry } from '../../domain/collection'
import type { Deck, DeckCard } from '../../domain/deck'

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** A basic artifact card with no all_parts. */
export const FIXTURE_CARD_SOL_RING: Card = {
  id: 'sol-ring-uuid',
  oracle_id: 'sol-ring-oracle',
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
    art_crop: 'https://cards.scryfall.io/art_crop/front/sol-ring.jpg',
  },
  prices: { usd: '1.50', eur: '1.20' },
  cachedAt: 1700000000000,
}

/** A legendary creature (no tokens) — valid as commander. */
export const FIXTURE_CARD_COMMANDER: Card = {
  id: 'commander-uuid',
  oracle_id: 'commander-oracle',
  name: 'Niv-Mizzet, Parun',
  set: 'grn',
  rarity: 'rare',
  type_line: 'Legendary Creature — Dragon Wizard',
  colors: ['U', 'R'],
  color_identity: ['U', 'R'],
  cmc: 6,
  mana_cost: '{U}{U}{U}{R}{R}{R}',
  oracle_text: 'Whenever you draw a card, Niv-Mizzet, Parun deals 1 damage to any target.',
  layout: 'normal',
  prices: { usd: '5.00' },
  cachedAt: 1700000000000,
}

/** A basic land card — exempt from singleton rule. */
export const FIXTURE_CARD_FOREST: Card = {
  id: 'forest-uuid',
  oracle_id: 'forest-oracle',
  name: 'Forest',
  set: 'lea',
  rarity: 'common',
  type_line: 'Basic Land — Forest',
  colors: [],
  color_identity: ['G'],
  cmc: 0,
  layout: 'normal',
  prices: { usd: '0.10' },
  cachedAt: 1700000000000,
}

/** A token card. */
export const FIXTURE_CARD_SAPROLING_TOKEN: Card = {
  id: 'saproling-token-uuid',
  oracle_id: 'saproling-token-oracle',
  name: 'Saproling',
  set: 'tdom',
  rarity: 'common',
  type_line: 'Token Creature — Saproling',
  colors: ['G'],
  color_identity: ['G'],
  cmc: 0,
  layout: 'token',
  cachedAt: 1700000000000,
}

/**
 * A creature that references the Saproling token via all_parts.
 * Used to test detectTokensFromDeck when all_parts is present.
 */
export const FIXTURE_CARD_TENDERSHOOT_DRYAD: Card = {
  id: 'tendershoot-uuid',
  oracle_id: 'tendershoot-oracle',
  name: 'Tendershoot Dryad',
  set: 'rix',
  rarity: 'rare',
  type_line: 'Creature — Dryad',
  colors: ['G'],
  color_identity: ['G'],
  cmc: 5,
  mana_cost: '{4}{G}',
  oracle_text: 'At the beginning of each upkeep, create a 1/1 green Saproling creature token.',
  layout: 'normal',
  all_parts: [
    {
      id: 'tendershoot-uuid',
      name: 'Tendershoot Dryad',
      type_line: 'Creature — Dryad',
      component: 'combo_piece',
    },
    {
      id: 'saproling-token-uuid',
      name: 'Saproling',
      type_line: 'Token Creature — Saproling',
      component: 'token',
    },
  ],
  prices: { usd: '3.00' },
  cachedAt: 1700000000000,
}

/** A card with NO all_parts (instant/sorcery that produces no tokens). */
export const FIXTURE_CARD_COUNTERSPELL: Card = {
  id: 'counterspell-uuid',
  oracle_id: 'counterspell-oracle',
  name: 'Counterspell',
  set: '7ed',
  rarity: 'uncommon',
  type_line: 'Instant',
  colors: ['U'],
  color_identity: ['U'],
  cmc: 2,
  mana_cost: '{U}{U}',
  oracle_text: 'Counter target spell.',
  layout: 'normal',
  prices: { usd: '2.00' },
  cachedAt: 1700000000000,
}

// ---------------------------------------------------------------------------
// CollectionEntries
// ---------------------------------------------------------------------------

/** Sol Ring, nonfoil, NM, qty=1. */
export const FIXTURE_ENTRY_SOL_RING: CollectionEntry = {
  cardId: 'sol-ring-uuid',
  finish: 'nonfoil',
  condition: 'NM',
  quantity: 1,
  forTrade: false,
  language: 'en',
  addedAt: 1700000000000,
  updatedAt: 1700000000000,
}

/** Sol Ring, foil, NM, qty=2. */
export const FIXTURE_ENTRY_SOL_RING_FOIL: CollectionEntry = {
  cardId: 'sol-ring-uuid',
  finish: 'foil',
  condition: 'NM',
  quantity: 2,
  forTrade: true,
  language: 'en',
  addedAt: 1700000000000,
  updatedAt: 1700000000000,
}

/** Counterspell, nonfoil, NM, qty=1. */
export const FIXTURE_ENTRY_COUNTERSPELL: CollectionEntry = {
  cardId: 'counterspell-uuid',
  finish: 'nonfoil',
  condition: 'NM',
  quantity: 1,
  forTrade: false,
  language: 'en',
  addedAt: 1700000000000,
  updatedAt: 1700000000000,
}

/** Saproling token owned, qty=3. */
export const FIXTURE_ENTRY_SAPROLING: CollectionEntry = {
  cardId: 'saproling-token-uuid',
  finish: 'nonfoil',
  condition: 'NM',
  quantity: 3,
  forTrade: false,
  language: 'en',
  addedAt: 1700000000000,
  updatedAt: 1700000000000,
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

export const FIXTURE_DECK: Deck = {
  name: 'Test Commander Deck',
  commanderId: 'commander-uuid',
  format: 'commander',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

// ---------------------------------------------------------------------------
// DeckCards
// ---------------------------------------------------------------------------

/** Commander slot. */
export const FIXTURE_DECKCARD_COMMANDER: DeckCard = {
  deckId: 1,
  cardId: 'commander-uuid',
  quantity: 1,
  category: 'commander',
  addedAt: 1700000000000,
}

/** Tendershoot Dryad in mainboard — produces Saproling token. */
export const FIXTURE_DECKCARD_TENDERSHOOT: DeckCard = {
  deckId: 1,
  cardId: 'tendershoot-uuid',
  quantity: 1,
  category: 'mainboard',
  addedAt: 1700000000000,
}

/** Counterspell in mainboard — no tokens. */
export const FIXTURE_DECKCARD_COUNTERSPELL: DeckCard = {
  deckId: 1,
  cardId: 'counterspell-uuid',
  quantity: 1,
  category: 'mainboard',
  addedAt: 1700000000000,
}

/** Sol Ring in mainboard — in decks, affects trade availability. */
export const FIXTURE_DECKCARD_SOL_RING: DeckCard = {
  deckId: 1,
  cardId: 'sol-ring-uuid',
  quantity: 1,
  category: 'mainboard',
  addedAt: 1700000000000,
}

// ---------------------------------------------------------------------------
// CSV fixtures
// ---------------------------------------------------------------------------

/** Moxfield CSV sample with 3 cards. */
export const FIXTURE_CSV_MOXFIELD = `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Collector Number
1,,Sol Ring,CMR,Near Mint,English,,369
2,,Counterspell,7ED,Near Mint,English,foil,64
1,,Forest,LEA,Near Mint,English,,294`

/** Archidekt CSV sample with 2 cards. */
export const FIXTURE_CSV_ARCHIDEKT = `Quantity,Name,Set Code,Card Number,Condition,Language,Finish
1,Sol Ring,CMR,369,NM,English,nonfoil
2,Counterspell,7ED,64,NM,English,foil`
