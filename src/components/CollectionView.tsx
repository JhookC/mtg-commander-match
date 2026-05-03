/**
 * CollectionView.tsx — Top-level collection tab panel.
 *
 * Composes: CollectionSearch, CollectionTable, CollectionImportModal, CollectionExportImport.
 * Shows loading state while CollectionProvider.isReady=false.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useState } from 'react'
import { Spinner } from '@heroui/react'
import { useCollection } from '../lib/collection-context'
import { CollectionSearch } from './CollectionSearch'
import { CollectionTable } from './CollectionTable'
import { CollectionImportModal } from './CollectionImportModal'
import { CollectionExportImport } from './CollectionExportImport'
import { DeckList } from './DeckList'

type CollectionSection = 'tabla' | 'mazos' | 'buscar' | 'respaldo'

export function CollectionView() {
  const { isReady } = useCollection()
  const [activeSection, setActiveSection] = useState<CollectionSection>('tabla')
  const [importModalOpen, setImportModalOpen] = useState(false)

  if (!isReady) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <Spinner size="sm" />
        Cargando colección…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subsection nav + action buttons in one row */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700">
        <nav className="flex gap-1">
          {(
            [
              { key: 'tabla', label: 'Colección' },
              { key: 'mazos', label: 'Mazos' },
              { key: 'buscar', label: 'Buscar carta' },
              { key: 'respaldo', label: 'Respaldo' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={
                'cursor-pointer px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ' +
                (activeSection === key
                  ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300')
              }
              aria-current={activeSection === key ? 'page' : undefined}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-wrap pb-2">
          <button
            type="button"
            onClick={() => setActiveSection('buscar')}
            className={
              'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
              (activeSection === 'buscar'
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                : 'border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800')
            }
          >
            + Agregar carta
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="cursor-pointer rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Importar CSV
          </button>
        </div>
      </div>

      {/* Content */}
      <section>
        {activeSection === 'tabla' && <CollectionTable />}
        {activeSection === 'mazos' && <DeckList />}
        {activeSection === 'buscar' && (
          <div className="max-w-xl">
            <CollectionSearch onAdded={() => setActiveSection('tabla')} />
          </div>
        )}
        {activeSection === 'respaldo' && <CollectionExportImport />}
      </section>

      {/* CSV Import Modal */}
      <CollectionImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  )
}
