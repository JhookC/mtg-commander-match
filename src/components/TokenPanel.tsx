/**
 * TokenPanel.tsx — Token have/missing list for a deck.
 *
 * Groups tokens by ownership status: "Tienes" vs "Te faltan".
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useQuery } from '@tanstack/react-query'
import { useTokensForDeck } from '../lib/collection-hooks'
import { resolveCardImageById } from '../providers/scryfall'
import type { Token } from '../domain/token'

interface Props {
  deckId: number
}

interface TokenItemProps {
  token: Token
}

function TokenItem({ token }: TokenItemProps) {
  const { data: resolvedImageUrl } = useQuery({
    queryKey: ['tokenImage', token.cardId],
    queryFn: ({ signal }) => resolveCardImageById(token.cardId, signal),
    staleTime: Infinity,
    enabled: !token.imageUrl,
  })

  const imageUrl = token.imageUrl ?? resolvedImageUrl

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1.5">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={token.name}
          className="w-10 h-14 rounded object-cover bg-zinc-100 dark:bg-zinc-800 flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-14 rounded bg-zinc-100 dark:bg-zinc-700 flex-shrink-0 flex items-center justify-center text-[10px] text-zinc-400">
          T
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
          {token.name}
        </p>
        {token.ownedQuantity > 0 && (
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {token.ownedQuantity} {token.ownedQuantity === 1 ? 'copia' : 'copias'}
          </p>
        )}
      </div>
      <span
        className={
          'text-xs font-bold flex-shrink-0 ' +
          (token.status === 'have'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-500 dark:text-red-400')
        }
        aria-label={token.status === 'have' ? 'Tienes este token' : 'Te falta este token'}
      >
        {token.status === 'have' ? '✓' : '✗'}
      </span>
    </div>
  )
}

export function TokenPanel({ deckId }: Props) {
  const tokens = useTokensForDeck(deckId)

  if (tokens.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
        Este mazo no produce tokens.
      </div>
    )
  }

  const haveTokens = tokens.filter((t) => t.status === 'have')
  const missingTokens = tokens.filter((t) => t.status === 'missing')

  return (
    <div className="flex flex-col gap-4">
      {/* Have section */}
      {haveTokens.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
            Tienes ({haveTokens.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {haveTokens.map((token) => (
              <TokenItem key={token.cardId} token={token} />
            ))}
          </div>
        </section>
      )}

      {/* Missing section */}
      {missingTokens.length > 0 ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
            Te faltan ({missingTokens.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {missingTokens.map((token) => (
              <TokenItem key={token.cardId} token={token} />
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          Tenés todos los tokens para este mazo.
        </p>
      )}
    </div>
  )
}
