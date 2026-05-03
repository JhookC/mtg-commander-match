/**
 * CollectionTable.tsx — Collection entry table with filters and sorting.
 *
 * Uses HeroUI v3 Table component pattern.
 * Filters and sorts collection entries via useCollectionEntries + sortEntriesByCard.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useState } from 'react'
import {
  useCollectionEntries,
  useCards,
  useTradeAvailabilityMap,
  sortEntriesByCard,
} from '../lib/collection-hooks'
import type { CollectionFilter, CollectionSort, CollectionSortField } from '../lib/collection-hooks'
import { useCollection } from '../lib/collection-context'
import type { CollectionEntry } from '../domain/collection'
import type { Card } from '../domain/collection'
import { FINISHES, CONDITIONS } from '../domain/collection'
import type { Finish, Condition } from '../domain/collection'

// ---------------------------------------------------------------------------
// Filter panel
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  filter: CollectionFilter
  onChange: (f: CollectionFilter) => void
}

const FINISH_LABELS: Record<Finish, string> = {
  nonfoil: 'Sin foil',
  foil: 'Foil',
  etched: 'Grabado',
}

const CONDITION_LABELS: Record<Condition, string> = {
  M: 'Menta',
  NM: 'Sin jugar',
  LP: 'Poco jugada',
  MP: 'Jugada',
  HP: 'Muy jugada',
  DMG: 'Dañada',
}

const MTG_COLORS = [
  { code: 'W', label: 'Blanco' },
  { code: 'U', label: 'Azul' },
  { code: 'B', label: 'Negro' },
  { code: 'R', label: 'Rojo' },
  { code: 'G', label: 'Verde' },
]

function FilterPanel({ filter, onChange }: FilterPanelProps) {
  function handleColorToggle(code: string) {
    const current = filter.colors ?? []
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code]
    onChange({ ...filter, colors: next.length ? next : undefined })
  }

  return (
    <div className="flex flex-wrap gap-2 items-end pb-3 border-b border-zinc-200 dark:border-zinc-700">
      {/* Name filter */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nombre</label>
        <input
          type="text"
          value={filter.name ?? ''}
          onChange={(e) => onChange({ ...filter, name: e.target.value || undefined })}
          placeholder="Buscar por nombre…"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
        />
      </div>

      {/* Set filter */}
      <div className="flex flex-col gap-1 min-w-[100px]">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Edición</label>
        <input
          type="text"
          value={filter.set ?? ''}
          onChange={(e) => onChange({ ...filter, set: e.target.value.toLowerCase() || undefined })}
          placeholder="cmr, 7ed…"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
        />
      </div>

      {/* Finish filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Acabado</label>
        <select
          value={filter.finish ?? ''}
          onChange={(e) =>
            onChange({ ...filter, finish: (e.target.value as Finish) || undefined })
          }
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
        >
          <option value="">Todos</option>
          {FINISHES.map((f) => (
            <option key={f} value={f}>{FINISH_LABELS[f]}</option>
          ))}
        </select>
      </div>

      {/* Condition filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Condición</label>
        <select
          value={filter.condition ?? ''}
          onChange={(e) =>
            onChange({ ...filter, condition: (e.target.value as Condition) || undefined })
          }
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
        >
          <option value="">Todas</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* forTrade filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Intercambio</label>
        <label className="flex items-center gap-1.5 h-[34px] cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={filter.forTrade === true}
            onChange={(e) =>
              onChange({ ...filter, forTrade: e.target.checked ? true : undefined })
            }
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          Solo disponibles
        </label>
      </div>

      {/* Color multi-select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Color</label>
        <div className="flex gap-1 h-[34px] items-center">
          {MTG_COLORS.map(({ code, label }) => {
            const selected = filter.colors?.includes(code)
            return (
              <button
                key={code}
                type="button"
                onClick={() => handleColorToggle(code)}
                title={label}
                className={
                  'cursor-pointer w-7 h-7 rounded-full border text-xs font-bold transition-colors ' +
                  (selected
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700')
                }
              >
                {code}
              </button>
            )
          })}
        </div>
      </div>

      {/* Clear filters */}
      <button
        type="button"
        onClick={() => onChange({})}
        className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 h-[34px]"
      >
        Limpiar filtros
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sort header button
// ---------------------------------------------------------------------------

const SORT_FIELDS: { field: CollectionSortField; label: string }[] = [
  { field: 'name', label: 'Nombre' },
  { field: 'set', label: 'Edición' },
  { field: 'rarity', label: 'Rareza' },
  { field: 'cmc', label: 'CMC' },
  { field: 'price', label: 'Precio' },
]

interface SortHeaderProps {
  field: CollectionSortField
  label: string
  current: CollectionSort
  onChange: (s: CollectionSort) => void
}

function SortHeader({ field, label, current, onChange }: SortHeaderProps) {
  const active = current.field === field
  function toggle() {
    if (active) {
      onChange({ field, direction: current.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      onChange({ field, direction: 'asc' })
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={
        'cursor-pointer text-left text-xs font-semibold uppercase tracking-wide transition-colors ' +
        (active
          ? 'text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300')
      }
    >
      {label}
      {active && (
        <span className="ml-1">{current.direction === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface RowProps {
  entry: CollectionEntry
  card: Card | undefined
  tradeAvailable: number
  onRemove: (id: number) => void
  onToggleForTrade: (id: number) => void
  onSetQty: (id: number, qty: number) => void
}

function CollectionRow({ entry, card, tradeAvailable, onRemove, onToggleForTrade, onSetQty }: RowProps) {
  const id = entry.id!

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {/* Image */}
      <td className="px-2 py-2 w-12">
        {card?.image_uris?.small ? (
          <img
            src={card.image_uris.small}
            alt={card.name}
            className="w-9 h-12 rounded object-cover bg-zinc-100 dark:bg-zinc-800"
            loading="lazy"
          />
        ) : (
          <div className="w-9 h-12 rounded bg-zinc-100 dark:bg-zinc-800" />
        )}
      </td>

      {/* Name */}
      <td className="px-2 py-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
          {card?.name ?? entry.cardId}
        </p>
        {card?.type_line && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
            {card.type_line}
          </p>
        )}
      </td>

      {/* Set */}
      <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
        {card ? card.set.toUpperCase() : '—'}
      </td>

      {/* Finish */}
      <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
        {entry.finish === 'foil' ? 'Foil' : entry.finish === 'etched' ? 'Grabado' : 'Normal'}
      </td>

      {/* Condition */}
      <td className="px-2 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
        {entry.condition}
      </td>

      {/* Quantity */}
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSetQty(id, entry.quantity - 1)}
            disabled={entry.quantity <= 1}
            className="cursor-pointer w-6 h-6 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm leading-none disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Disminuir cantidad"
          >
            −
          </button>
          <span className="w-7 text-center text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
            {entry.quantity}
          </span>
          <button
            type="button"
            onClick={() => onSetQty(id, entry.quantity + 1)}
            className="cursor-pointer w-6 h-6 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm leading-none"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>
      </td>

      {/* Price */}
      <td className="px-2 py-2 text-sm tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
        {card?.prices?.usd ? `$${card.prices.usd}` : '—'}
      </td>

      {/* Disponible para intercambio */}
      <td className="px-2 py-2 text-center">
        <span
          title="Disponible para intercambio (no comprometido en mazos)"
          className={
            'text-xs font-semibold tabular-nums ' +
            (tradeAvailable > 0
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-zinc-400 dark:text-zinc-500')
          }
        >
          {tradeAvailable}
        </span>
      </td>

      {/* forTrade toggle */}
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          onClick={() => onToggleForTrade(id)}
          title="Para intercambio (intención del usuario)"
          className={
            'cursor-pointer text-xs font-medium rounded-full px-2 py-0.5 transition-colors ' +
            (entry.forTrade
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700')
          }
          aria-pressed={entry.forTrade}
          aria-label="Para intercambio"
        >
          {entry.forTrade ? 'Sí' : 'No'}
        </button>
      </td>

      {/* Actions */}
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="cursor-pointer rounded p-1 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 leading-none"
          aria-label="Eliminar carta de la colección"
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// CollectionTable
// ---------------------------------------------------------------------------

export function CollectionTable() {
  const { removeEntry, toggleForTrade, setQuantity } = useCollection()

  const [filter, setFilter] = useState<CollectionFilter>({})
  const [sort, setSort] = useState<CollectionSort>({ field: 'name', direction: 'asc' })

  const rawEntries = useCollectionEntries(filter, sort)
  const cardsById = useCards()
  const tradeMap = useTradeAvailabilityMap()

  // Apply card-based sort (name, set, rarity, cmc, price need cardsById)
  const entries = sortEntriesByCard(rawEntries, cardsById, sort)

  if (!rawEntries.length && !Object.keys(filter).some((k) => filter[k as keyof CollectionFilter] !== undefined)) {
    return (
      <div className="flex flex-col gap-3">
        <FilterPanel filter={filter} onChange={setFilter} />
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Tu colección está vacía. Agrega cartas con el buscador o importa desde un archivo CSV.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterPanel filter={filter} onChange={setFilter} />

      {entries.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Sin resultados con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full bg-white dark:bg-zinc-900 text-left">
            <thead className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-2 py-2 w-12" aria-label="Imagen" />
                {SORT_FIELDS.slice(0, 2).map(({ field, label }) => (
                  <th key={field} className="px-2 py-2">
                    <SortHeader field={field} label={label} current={sort} onChange={setSort} />
                  </th>
                ))}
                {/* Acabado */}
                <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Acabado
                </th>
                {/* Condición */}
                <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Condición
                </th>
                {/* Cantidad */}
                <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Cantidad
                </th>
                {SORT_FIELDS.slice(4).map(({ field, label }) => (
                  <th key={field} className="px-2 py-2">
                    <SortHeader field={field} label={label} current={sort} onChange={setSort} />
                  </th>
                ))}
                {/* Disponible */}
                <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 text-center whitespace-nowrap">
                  Disponible
                </th>
                {/* Para intercambio */}
                <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 text-center whitespace-nowrap">
                  Intercambio
                </th>
                {/* Actions */}
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const card = cardsById.get(entry.cardId)
                const tradeAvailable = tradeMap.get(entry.cardId)?.available ?? 0
                return (
                  <CollectionRow
                    key={entry.id}
                    entry={entry}
                    card={card}
                    tradeAvailable={tradeAvailable}
                    onRemove={removeEntry}
                    onToggleForTrade={toggleForTrade}
                    onSetQty={setQuantity}
                  />
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-xs text-zinc-500 dark:text-zinc-400">
            {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
          </div>
        </div>
      )}
    </div>
  )
}
