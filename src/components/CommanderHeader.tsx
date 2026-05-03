import { Chip } from '@heroui/react'
import type { Commander } from '../domain/commander'
import { useImagePreview } from '../lib/preview-context'

const COLOR_NAMES: Record<string, string> = {
  W: 'Blanco',
  U: 'Azul',
  B: 'Negro',
  R: 'Rojo',
  G: 'Verde',
}

interface Props {
  commander: Commander
}

export function CommanderHeader({ commander }: Props) {
  const thumb = commander.artCropUrl ?? commander.imageUrl
  const hasOracle = !!commander.oracleText
  const setPreview = useImagePreview()
  const fullImage = commander.imageUrl ?? commander.artCropUrl

  const summaryRow = (
    <div className="flex items-center gap-3 p-3">
      {thumb && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (fullImage) setPreview(fullImage)
          }}
          className="cursor-zoom-in flex-shrink-0"
          aria-label={`Ver ${commander.name} en grande`}
        >
          <img
            src={thumb}
            alt=""
            className="w-20 h-20 rounded-md object-cover"
            loading="eager"
          />
        </button>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {commander.name}
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
          {commander.typeLine}
        </p>
        <div className="flex flex-wrap gap-1">
          {commander.colorIdentity.length === 0 ? (
            <Chip>Incoloro</Chip>
          ) : (
            commander.colorIdentity.map((c) => (
              <Chip key={c}>{COLOR_NAMES[c] ?? c}</Chip>
            ))
          )}
          {commander.cmc !== null && <Chip>CMC {commander.cmc}</Chip>}
          {commander.edhrecRank !== null && (
            <Chip>EDHRec #{commander.edhrecRank.toLocaleString()}</Chip>
          )}
        </div>
      </div>
      {hasOracle && (
        <span
          aria-hidden
          className="text-zinc-400 group-open:rotate-180 transition-transform flex-shrink-0 px-2 select-none"
        >
          ▼
        </span>
      )}
    </div>
  )

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
      {hasOracle ? (
        <details className="group">
          <summary className="cursor-pointer list-none hover:bg-zinc-50 dark:hover:bg-zinc-800/50 [&::-webkit-details-marker]:hidden">
            {summaryRow}
          </summary>
          <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
              {commander.oracleText}
            </p>
          </div>
        </details>
      ) : (
        summaryRow
      )}
    </div>
  )
}
