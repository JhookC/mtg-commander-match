import type { NormalizedCard } from '../domain/card'
import type { WishlistItem } from '../domain/wishlist'
import { fromVariant, variantId } from '../domain/wishlist'

const EXPORT_VERSION = 1

interface ExportItem {
  matchKey: string
  displayName: string
  sourceName: string
  setName: string
  setCode: string
  collectorNumber: string
  finish: string
  condition: string
  language: string
  qty: number
}

interface ExportFormat {
  version: number
  exportedAt: string
  items: ExportItem[]
}

export function buildExport(items: WishlistItem[]): ExportFormat {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map((it) => ({
      matchKey: it.matchKey,
      displayName: it.displayName,
      sourceName: it.sourceName,
      setName: it.setName,
      setCode: it.setCode,
      collectorNumber: it.collectorNumber,
      finish: it.finish,
      condition: it.condition,
      language: it.language,
      qty: it.qty,
    })),
  }
}

export function exportToJson(items: WishlistItem[]): string {
  return JSON.stringify(buildExport(items), null, 2)
}

function isExportFormat(raw: unknown): raw is ExportFormat {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>
  return (
    typeof obj.version === 'number' &&
    typeof obj.exportedAt === 'string' &&
    Array.isArray(obj.items)
  )
}

function findMatchingVariant(
  imported: ExportItem,
  catalog: NormalizedCard[],
): NormalizedCard | null {
  return (
    catalog.find(
      (v) =>
        v.matchKey === imported.matchKey &&
        v.setCode === imported.setCode &&
        v.collectorNumber === imported.collectorNumber &&
        v.finish === imported.finish &&
        v.condition === imported.condition &&
        v.language === imported.language,
    ) ?? null
  )
}

export interface ImportResult {
  imported: WishlistItem[]
  matched: number
  unavailable: number
}

/**
 * Parse an exported wishlist and resolve each item against the given catalogs.
 * Items that match a current stock entry come back with full data (sourceMeta,
 * fresh price, image). Items without a match come back as placeholders (price
 * preserved if known, sourceMeta absent) so the user still sees what they had.
 */
export function importFromJson(
  jsonText: string,
  catalogsByShop: Map<string, NormalizedCard[]>,
): ImportResult {
  const parsed: unknown = JSON.parse(jsonText)
  if (!isExportFormat(parsed)) {
    throw new Error('Formato de archivo inválido.')
  }
  const out: WishlistItem[] = []
  let matched = 0
  let unavailable = 0
  for (const ex of parsed.items) {
    const catalog = catalogsByShop.get(ex.sourceName) ?? []
    const variant = findMatchingVariant(ex, catalog)
    if (variant) {
      out.push(fromVariant(variant, ex.qty))
      matched++
    } else {
      out.push({
        id: [
          ex.sourceName,
          ex.matchKey,
          ex.setCode,
          ex.collectorNumber,
          ex.finish,
          ex.condition,
          ex.language,
        ].join('|'),
        matchKey: ex.matchKey,
        displayName: ex.displayName,
        sourceName: ex.sourceName,
        setName: ex.setName,
        setCode: ex.setCode,
        collectorNumber: ex.collectorNumber,
        finish: ex.finish,
        condition: ex.condition,
        language: ex.language,
        price: 0,
        currency: 'COP',
        imageUrl: null,
        qty: ex.qty,
        addedAt: Date.now(),
      })
      unavailable++
    }
  }
  return { imported: out, matched, unavailable }
}

export function isAvailable(
  item: WishlistItem,
  catalog: NormalizedCard[] | undefined,
): boolean {
  if (!catalog) return true // unknown — don't dim until we know
  const id = variantId({
    matchKey: item.matchKey,
    sourceName: item.sourceName,
    setCode: item.setCode,
    collectorNumber: item.collectorNumber,
    finish: item.finish,
    condition: item.condition,
    language: item.language,
  } as NormalizedCard)
  return catalog.some((v) => variantId(v) === id)
}
