/**
 * OutOfStockCardItem.tsx — Card display for the "Carta específica" mode when a
 * card is NOT available in any monitored store.
 *
 * Renders the card image + name + type line + chips so the user can confirm they
 * searched the correct card and see ownership status, even without store stock.
 *
 * Visually mirrors MatchedCardItem (Card.Header / image / Card.Content) so the
 * "result region" feels consistent between in-stock and out-of-stock states.
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { Card, Chip } from '@heroui/react'
import type { CardDetails } from '../providers/scryfall'
import { useImagePreview } from '../lib/preview-context'

interface Props {
  card: CardDetails
  collectionQuantity: number
}

export function OutOfStockCardItem({ card, collectionQuantity }: Props) {
  const setPreview = useImagePreview()
  const ownedCount = collectionQuantity
  return (
    <Card className="overflow-hidden">
      {card.imageUrl ? (
        <button
          type="button"
          onClick={() => setPreview(card.imageUrl)}
          className="block w-full cursor-zoom-in p-2 pb-0"
          aria-label={`Ver ${card.name} en grande`}
        >
          <img
            src={card.imageUrl}
            alt={card.name}
            className="w-full aspect-[488/680] object-cover opacity-70 rounded-md"
            loading="lazy"
          />
        </button>
      ) : (
        <div className="m-2 mb-0 aspect-[488/680] rounded-md bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">
          Sin imagen
        </div>
      )}
      <Card.Content className="flex flex-col gap-2 p-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
            {card.name}
          </p>
          {card.typeLine && (
            <p className="text-xs text-zinc-500 truncate">{card.typeLine}</p>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          No disponible en tiendas
        </p>
        {ownedCount > 0 && (
          <div>
            <Chip color="success">En tu colección: {ownedCount}</Chip>
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
