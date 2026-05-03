/**
 * collection-io.ts — CSV import (Moxfield / Archidekt) and JSON backup export/import.
 *
 * PapaParse is lazy-imported (dynamic import) — NOT in the main bundle (NFR-004).
 * dexie-export-import is also lazy-imported for the same reason.
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import type { CollectionDb } from './collection-db'
import type { Card, Finish, Condition, CollectionEntry } from '../domain/collection'
import type { Deck, DeckCard } from '../domain/deck'
import type { ImportSummary } from './collection-context'
import type { ScryfallIdentifier } from '../providers/scryfall-cards'
import { getCardsByIds } from '../providers/scryfall-cards'

// ---------------------------------------------------------------------------
// Dexie export format (used for backup merge)
// ---------------------------------------------------------------------------

interface DexieExportTableData {
  tableName: string
  inbound: boolean
  rows: Record<string, unknown>[]
}

interface DexieExportFormat {
  data: { data: DexieExportTableData[] }
}

// ---------------------------------------------------------------------------
// CSV Import
// ---------------------------------------------------------------------------

interface NormalizedCsvRow {
  count: number
  name: string
  set?: string
  collectorNumber?: string
  condition?: Condition
  language?: string
  finish?: Finish
}

type CsvRowField = keyof NormalizedCsvRow

// Column alias maps — header (trimmed) → NormalizedCsvRow field
const MOXFIELD_ALIASES: Record<string, CsvRowField> = {
  Count: 'count',
  Name: 'name',
  Edition: 'set',
  Condition: 'condition',
  Language: 'language',
  Foil: 'finish',
  'Collector Number': 'collectorNumber',
}

const ARCHIDEKT_ALIASES: Record<string, CsvRowField> = {
  Quantity: 'count',
  Name: 'name',
  'Set Code': 'set',
  'Edition Code': 'set',
  Condition: 'condition',
  Language: 'language',
  Finish: 'finish',
  'Collector Number': 'collectorNumber',
  'Card Number': 'collectorNumber',
}

/**
 * Auto-detects the CSV format from headers.
 * Returns 'moxfield', 'archidekt', or null (unknown).
 */
function detectFormat(headers: string[]): 'moxfield' | 'archidekt' | null {
  const headerSet = new Set(headers)
  // Moxfield signature: has 'Tradelist Count' OR 'Foil' (capitalized) with 'Edition'
  if (headerSet.has('Tradelist Count') || (headerSet.has('Foil') && headerSet.has('Edition'))) {
    return 'moxfield'
  }
  // Archidekt signature: has 'Finish' with 'Set Code' OR 'Edition Code'
  if (headerSet.has('Finish') && (headerSet.has('Set Code') || headerSet.has('Edition Code'))) {
    return 'archidekt'
  }
  // Fallback: if has Quantity + Name but no Finish, could be either — try Archidekt
  if (headerSet.has('Quantity') && headerSet.has('Name')) {
    return 'archidekt'
  }
  return null
}

const VALID_FINISHES: ReadonlySet<string> = new Set(['nonfoil', 'foil', 'etched'])
const VALID_CONDITIONS: ReadonlySet<string> = new Set(['M', 'NM', 'LP', 'MP', 'HP', 'DMG'])

function normalizeFinish(raw: string | undefined): Finish {
  if (!raw) return 'nonfoil'
  const lower = raw.toLowerCase().trim()
  // Moxfield: 'foil' | 'etched' | '' → map '' to 'nonfoil'
  if (lower === 'foil') return 'foil'
  if (lower === 'etched') return 'etched'
  return 'nonfoil'
}

function normalizeCondition(raw: string | undefined): Condition {
  if (!raw) return 'NM'
  const upper = raw.trim().toUpperCase()
  // Handle verbose condition names (Moxfield uses "Near Mint", "Lightly Played", etc.)
  const verboseMap: Record<string, Condition> = {
    'NEAR MINT': 'NM',
    'LIGHTLY PLAYED': 'LP',
    'MODERATELY PLAYED': 'MP',
    'HEAVILY PLAYED': 'HP',
    DAMAGED: 'DMG',
    MINT: 'M',
    // Short codes already match
    NM: 'NM',
    LP: 'LP',
    MP: 'MP',
    HP: 'HP',
    DMG: 'DMG',
    M: 'M',
  }
  return verboseMap[upper] ?? 'NM'
}

function normalizeRow(
  rawRow: Record<string, string>,
  aliases: Record<string, CsvRowField>,
): Partial<NormalizedCsvRow> {
  const out: Partial<NormalizedCsvRow> = {}
  for (const [header, field] of Object.entries(aliases)) {
    const value = rawRow[header]
    if (value === undefined) continue
    if (field === 'count') {
      const parsed = parseInt(value, 10)
      if (!isNaN(parsed) && parsed > 0) out.count = parsed
    } else if (field === 'finish') {
      out.finish = normalizeFinish(value)
    } else if (field === 'condition') {
      out.condition = normalizeCondition(value)
    } else {
      ;(out as Record<string, string>)[field] = value.trim()
    }
  }
  return out
}

/**
 * Imports a CSV string into the collection.
 *
 * @param text   - Raw CSV text content.
 * @param format - 'moxfield' | 'archidekt' | 'auto' (auto-detect from headers).
 * @param db     - Dexie database instance to write to.
 */
export async function importCsv(
  text: string,
  format: 'moxfield' | 'archidekt' | 'auto',
  db: CollectionDb,
): Promise<ImportSummary> {
  // Lazy import PapaParse — keep it out of the main bundle
  const { default: Papa } = await import('papaparse')

  const parseResult = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  const headers = parseResult.meta.fields ?? []
  const rows = parseResult.data

  // Determine effective format
  let effectiveFormat: 'moxfield' | 'archidekt'
  if (format === 'auto') {
    const detected = detectFormat(headers)
    if (!detected) {
      return {
        added: 0,
        updated: 0,
        skipped: rows.length,
        errors: rows.map((_, i) => ({ row: i + 1, reason: 'Formato no reconocido' })),
      }
    }
    effectiveFormat = detected
  } else {
    effectiveFormat = format
  }

  const aliases = effectiveFormat === 'moxfield' ? MOXFIELD_ALIASES : ARCHIDEKT_ALIASES

  // Normalize rows
  const normalized: Array<{ row: NormalizedCsvRow; rowIndex: number }> = []
  const errors: Array<{ row: number; reason: string }> = []
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]!
    const partial = normalizeRow(rawRow, aliases)

    if (!partial.name || !partial.count) {
      errors.push({ row: i + 1, reason: 'Formato no reconocido' })
      skipped++
      continue
    }

    normalized.push({
      row: {
        count: partial.count,
        name: partial.name,
        set: partial.set,
        collectorNumber: partial.collectorNumber,
        condition: partial.condition ?? 'NM',
        language: partial.language ?? 'en',
        finish: partial.finish ?? 'nonfoil',
      },
      rowIndex: i + 1,
    })
  }

  if (normalized.length === 0) {
    return { added: 0, updated: 0, skipped, errors }
  }

  // Build Scryfall identifiers (prefer collector_number+set, then name+set, then name)
  const identifiers: ScryfallIdentifier[] = normalized.map(({ row }) => {
    if (row.collectorNumber && row.set) {
      return { collector_number: row.collectorNumber, set: row.set.toLowerCase() }
    }
    if (row.set) {
      return { name: row.name, set: row.set.toLowerCase() }
    }
    return { name: row.name }
  })

  // Resolve cards via Scryfall (batched ≤75)
  const { found: resolvedCards, not_found: notFound } = await getCardsByIds(identifiers)

  // Build lookup map: name (lowercase) → Card (for matching by name when id isn't available)
  const cardByName = new Map(resolvedCards.map((c) => [c.name.toLowerCase(), c]))

  // Track which normalized rows resolved (by index)
  const rowResults: Array<{ row: NormalizedCsvRow; rowIndex: number; cardId: string | null }> =
    normalized.map(({ row, rowIndex }, idx) => {
      const identifier = identifiers[idx]!
      // Try to match by id first (from collection endpoint)
      const matchedCard = resolvedCards.find((c) => {
        if (identifier.collector_number && identifier.set) {
          // Match by set+collector_number (lowercased)
          return c.set.toLowerCase() === identifier.set && c.id !== undefined
        }
        return c.name.toLowerCase() === row.name.toLowerCase()
      })
      if (matchedCard) return { row, rowIndex, cardId: matchedCard.id }

      // Secondary fallback: name match
      const byName = cardByName.get(row.name.toLowerCase())
      if (byName) return { row, rowIndex, cardId: byName.id }

      return { row, rowIndex, cardId: null }
    })

  // Check which identifiers are in not_found — map them to errors
  // (We use a simple comparison by building a set of unresolvable row indexes)
  const unresolvedCount = rowResults.filter((r) => r.cardId === null).length
  for (const { rowIndex, cardId } of rowResults) {
    if (cardId === null) {
      errors.push({ row: rowIndex, reason: 'Carta no encontrada en Scryfall' })
    }
  }
  void notFound // acknowledged — handled via cardId === null check above

  // Upsert resolved cards into Dexie
  let added = 0
  let updated = 0
  const now = Date.now()

  const resolvedRows = rowResults.filter((r) => r.cardId !== null)
  if (resolvedRows.length > 0) {
    await db.transaction('rw', db.cards, db.collection, async () => {
      for (const { row, cardId } of resolvedRows) {
        if (!cardId) continue
        const card = resolvedCards.find((c) => c.id === cardId) ?? cardByName.get(row.name.toLowerCase())
        if (!card) continue

        // Upsert card metadata
        await db.cards.put({ ...card, cachedAt: now })

        const finish: Finish = VALID_FINISHES.has(row.finish ?? '') ? (row.finish as Finish) : 'nonfoil'
        const condition: Condition = VALID_CONDITIONS.has(row.condition ?? '') ? (row.condition as Condition) : 'NM'

        // Check for existing entry
        const existing = await db.collection
          .where('[cardId+finish+condition]')
          .equals([card.id, finish, condition])
          .first()

        if (existing?.id !== undefined) {
          await db.collection.update(existing.id, {
            quantity: existing.quantity + row.count,
            updatedAt: now,
          })
          updated++
        } else {
          await db.collection.add({
            cardId: card.id,
            finish,
            condition,
            quantity: row.count,
            forTrade: false,
            language: row.language ?? 'en',
            addedAt: now,
            updatedAt: now,
          })
          added++
        }
      }
    })
  }

  return {
    added,
    updated,
    skipped: skipped + unresolvedCount,
    errors,
  }
}

// ---------------------------------------------------------------------------
// CSV Export (Archidekt-compatible)
// ---------------------------------------------------------------------------

/**
 * Exports the collection as a CSV file in Archidekt import format.
 * Columns: Quantity, Name, Set Code, Finish, Condition, Language.
 * collector_number is omitted — not stored in the Card cache.
 */
export async function exportCsv(db: CollectionDb): Promise<Blob> {
  const { default: Papa } = await import('papaparse')

  const [entries, allCards] = await Promise.all([
    db.collection.toArray(),
    db.cards.toArray(),
  ])

  const cardById = new Map(allCards.map((c) => [c.id, c]))

  const rows = entries.flatMap((entry) => {
    const card = cardById.get(entry.cardId)
    if (!card) return []
    return [
      {
        Quantity: entry.quantity,
        Name: card.name,
        'Set Code': card.set.toUpperCase(),
        Finish: entry.finish,
        Condition: entry.condition,
        Language: entry.language,
      },
    ]
  })

  const csv = Papa.unparse(rows)
  return new Blob([csv], { type: 'text/csv' })
}

export function csvFilename(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  const parts = fmt.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `mtg-collection-${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}.csv`
}

// ---------------------------------------------------------------------------
// Backup envelope
// ---------------------------------------------------------------------------

interface BackupEnvelope {
  schemaVersion: 1
  exportedAt: string
  payload: string // raw dexie-export-import JSON text
}

function isBackupEnvelope(raw: unknown): raw is BackupEnvelope {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>
  return (
    obj.schemaVersion === 1 &&
    typeof obj.exportedAt === 'string' &&
    typeof obj.payload === 'string'
  )
}

// ---------------------------------------------------------------------------
// Backup export
// ---------------------------------------------------------------------------

/**
 * Exports the full database as a versioned JSON backup blob.
 * Wraps the dexie-export-import payload in a BackupEnvelope.
 */
export async function exportBackup(db: CollectionDb): Promise<Blob> {
  const { exportDB } = await import('dexie-export-import')
  const dexieBlob = await exportDB(db, { prettyJson: false })
  const payloadText = await dexieBlob.text()

  const envelope: BackupEnvelope = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    payload: payloadText,
  }

  return new Blob([JSON.stringify(envelope)], { type: 'application/json' })
}

// ---------------------------------------------------------------------------
// Backup import
// ---------------------------------------------------------------------------

/**
 * How to handle a collection entry that already exists (same cardId+finish+condition)
 * during a merge import.
 *  - 'sum'     → add imported quantity to existing quantity
 *  - 'replace' → overwrite existing quantity with imported quantity
 *  - 'skip'    → keep existing entry unchanged
 */
export type MergeStrategy = 'sum' | 'replace' | 'skip'

/**
 * Imports from a versioned JSON backup blob.
 *
 * @param blob          - The backup blob (from exportBackup or a file input).
 * @param mode          - 'merge' keeps existing data; 'replace' clears all tables first.
 * @param db            - Dexie database instance to write to.
 * @param mergeStrategy - Only used when mode='merge'. Defaults to 'sum'.
 */
export async function importBackup(
  blob: Blob,
  mode: 'merge' | 'replace',
  db: CollectionDb,
  mergeStrategy: MergeStrategy = 'sum',
): Promise<ImportSummary> {
  const text = await blob.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Archivo no válido')
  }

  if (!isBackupEnvelope(parsed)) {
    if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed) {
      const version = (parsed as Record<string, unknown>).schemaVersion
      throw new Error(`Versión de archivo no compatible (versión ${String(version)})`)
    }
    throw new Error('Archivo no válido')
  }

  if (parsed.schemaVersion !== 1) {
    throw new Error(`Versión de archivo no compatible (versión ${parsed.schemaVersion})`)
  }

  if (mode === 'replace') {
    const { importInto } = await import('dexie-export-import')
    const payloadBlob = new Blob([parsed.payload], { type: 'application/json' })
    await importInto(db, payloadBlob, { clearTablesBeforeImport: true, overwriteValues: true })
    const collectionCount = await db.collection.count()
    return { added: collectionCount, updated: 0, skipped: 0, errors: [] }
  }

  // Merge mode: parse payload manually and increment quantities by [cardId+finish+condition].
  // dexie-export-import's overwriteValues works by primary key — it would overwrite quantities
  // instead of summing them. We implement the merge ourselves.
  let dexieExport: DexieExportFormat
  try {
    dexieExport = JSON.parse(parsed.payload) as DexieExportFormat
  } catch {
    throw new Error('Archivo no válido')
  }

  const tableMap = new Map(dexieExport.data.data.map((t) => [t.tableName, t.rows]))

  const now = Date.now()
  let added = 0
  let updated = 0

  // 1. Upsert cards by Scryfall UUID (idempotent)
  const cardRows = (tableMap.get('cards') ?? []) as unknown as Card[]
  if (cardRows.length > 0) await db.cards.bulkPut(cardRows)

  // 2. Merge collection entries by [cardId+finish+condition] — sum quantities
  const collectionRows = (tableMap.get('collection') ?? []) as unknown as CollectionEntry[]
  if (collectionRows.length > 0) {
    await db.transaction('rw', db.collection, async () => {
      for (const entry of collectionRows) {
        const existing = await db.collection
          .where('[cardId+finish+condition]')
          .equals([entry.cardId, entry.finish, entry.condition])
          .first()
        if (existing?.id !== undefined) {
          if (mergeStrategy === 'skip') {
            // keep existing unchanged
          } else if (mergeStrategy === 'replace') {
            await db.collection.update(existing.id, { quantity: entry.quantity, updatedAt: now })
            updated++
          } else {
            // sum (default)
            await db.collection.update(existing.id, {
              quantity: existing.quantity + entry.quantity,
              updatedAt: now,
            })
            updated++
          }
        } else {
          const { id: _id, ...withoutId } = entry
          await db.collection.add({ ...withoutId, addedAt: entry.addedAt ?? now, updatedAt: now })
          added++
        }
      }
    })
  }

  // 3. Upsert decks and deckCards by their auto-increment id (preserve structure)
  const deckRows = (tableMap.get('decks') ?? []) as unknown as Deck[]
  if (deckRows.length > 0) await db.decks.bulkPut(deckRows)

  const deckCardRows = (tableMap.get('deckCards') ?? []) as unknown as DeckCard[]
  if (deckCardRows.length > 0) await db.deckCards.bulkPut(deckCardRows)

  return { added, updated, skipped: 0, errors: [] }
}

// ---------------------------------------------------------------------------
// Backup filename helper
// ---------------------------------------------------------------------------

/**
 * Returns a timestamped filename for a backup file.
 * Format: mtg-collection-backup-YYYYMMDD-HHmm.json
 * Uses Intl.DateTimeFormat — no shared date utility needed.
 */
export function backupFilename(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })

  // en-CA gives "YYYY-MM-DD, HH:MM" format
  const parts = fmt.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')

  return `mtg-collection-backup-${year}${month}${day}-${hour}${minute}.json`
}
