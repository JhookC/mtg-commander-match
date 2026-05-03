import { Card, Chip } from '@heroui/react'
import type { MatchedCardGroup } from '../domain/card'
import { formatPercent, formatPrice } from '../lib/format'
import { useImagePreview } from '../lib/preview-context'

interface Props {
  group: MatchedCardGroup
}

export function MatchedCardItem({ group }: Props) {
  const primary = group.primaryVariant
  const hasMultiple = group.variants.length > 1
  const setPreview = useImagePreview()
  return (
    <Card className="overflow-hidden">
      {primary.imageUrl ? (
        <button
          type="button"
          onClick={() => setPreview(primary.imageUrl)}
          className="block w-full cursor-zoom-in"
          aria-label={`Ver ${group.displayName} en grande`}
        >
          <img
            src={primary.imageUrl}
            alt={group.displayName}
            className="w-full aspect-[488/680] object-cover"
            loading="lazy"
          />
        </button>
      ) : (
        <div className="w-full aspect-[488/680] bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">
          Sin imagen
        </div>
      )}
      <Card.Content className="flex flex-col gap-2 p-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
            {group.displayName}
          </p>
          {primary.typeLine && (
            <p className="text-xs text-zinc-500 truncate">{primary.typeLine}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {group.isHighSynergy && <Chip color="accent">Alta sinergia</Chip>}
          {group.isTopCard && <Chip color="success">Carta clave</Chip>}
          {group.isGameChanger && <Chip color="warning">Decisiva</Chip>}
          <Chip>{formatPercent(group.inclusionRate)} de los decks</Chip>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
          <span aria-hidden>🏪</span>
          <span className="truncate">{group.availableSources.join(' · ')}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {hasMultiple ? 'desde ' : ''}
            {formatPrice(group.minPrice, group.currency)}
          </span>
          <span className="text-xs text-zinc-500">
            {group.totalStock} disponibles
          </span>
        </div>
        {hasMultiple && (
          <details className="text-xs group">
            <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
              <span className="group-open:rotate-90 transition-transform">▶</span>
              <span>
                +{group.variants.length - 1}{' '}
                {group.variants.length - 1 === 1 ? 'variante' : 'variantes'}
              </span>
            </summary>
            <ul className="mt-2 space-y-2 max-h-72 overflow-y-auto">
              {group.variants.slice(1).map((v) => (
                <li key={v.sourceId} className="flex items-center gap-2">
                  {v.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreview(v.imageUrl)}
                      className="cursor-zoom-in flex-shrink-0"
                      aria-label="Ver carta en grande"
                    >
                      <img
                        src={v.imageUrl}
                        alt=""
                        className="w-10 h-14 rounded object-cover bg-zinc-200 dark:bg-zinc-800"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div className="w-10 h-14 rounded bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {v.setCode.toUpperCase()} · #{v.collectorNumber}
                    </span>
                    <span className="truncate text-zinc-500 dark:text-zinc-500">
                      {v.sourceName} · {v.finish} · {v.condition}
                    </span>
                  </div>
                  <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                    {formatPrice(v.price, v.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card.Content>
    </Card>
  )
}
