/**
 * MatchView.tsx — "Búsqueda" section.
 *
 * Owns the search-mode state (commander vs card lookup) and renders the matching
 * view. The mode selector is rendered as a PREFIX inside the search input itself
 * (input group pattern) — eliminates visual repetition with the header's segmented
 * control and keeps the control adjacent to the field it modifies.
 *
 * Modes are fully independent — switching does NOT carry state between them
 * (each view owns its own selection + queries).
 *
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useState } from 'react'
import { CommanderMatchView } from './CommanderMatchView'
import { CardLookupView } from './CardLookupView'
import { ModeSelectorPrefix, type ModeOption } from './ModeSelectorPrefix'

type SearchMode = 'commander' | 'card'

const MODE_OPTIONS: Array<ModeOption<SearchMode>> = [
  { key: 'commander', label: 'Por comandante' },
  { key: 'card', label: 'Carta específica' },
]

export function MatchView() {
  const [mode, setMode] = useState<SearchMode>('commander')
  const [inputValue, setInputValue] = useState('')

  const prefix = (
    <ModeSelectorPrefix
      value={mode}
      onChange={setMode}
      options={MODE_OPTIONS}
      ariaLabel="Modo de búsqueda"
    />
  )

  return (
    <div className="flex flex-col gap-6 w-full">
      {mode === 'commander' && (
        <CommanderMatchView
          prefixSlot={prefix}
          inputValue={inputValue}
          onInputChange={setInputValue}
        />
      )}
      {mode === 'card' && (
        <CardLookupView
          prefixSlot={prefix}
          inputValue={inputValue}
          onInputChange={setInputValue}
        />
      )}
    </div>
  )
}
