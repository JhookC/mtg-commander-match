/**
 * CollectionImportModal.tsx — CSV import modal for the collection.
 *
 * Accepts .csv and .txt files.
 * Format selector: Auto, Moxfield, Archidekt.
 * Shows import summary (added/updated/skipped/errors) before closing.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { useRef, useState } from 'react'
import { Spinner } from '@heroui/react'
import { useCollection } from '../lib/collection-context'
import type { ImportSummary } from '../lib/collection-context'

interface Props {
  isOpen: boolean
  onClose: () => void
}

type ImportFormat = 'auto' | 'moxfield' | 'archidekt'

const FORMAT_LABELS: Record<ImportFormat, string> = {
  auto: 'Automático',
  moxfield: 'Moxfield',
  archidekt: 'Archidekt',
}

export function CollectionImportModal({ isOpen, onClose }: Props) {
  const { importCsv } = useCollection()

  const [format, setFormat] = useState<ImportFormat>('auto')
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  function handleClose() {
    setSummary(null)
    setImportError(null)
    setSelectedFile(null)
    setFormat('auto')
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setSummary(null)
    setImportError(null)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  async function handleImport() {
    if (!selectedFile) return
    setImporting(true)
    setImportError(null)

    try {
      const text = await selectedFile.text()
      const result = await importCsv(text, format)
      setSummary(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al importar el archivo.'
      setImportError(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={summary ? undefined : handleClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar colección"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Importar colección
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="cursor-pointer rounded-md p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {!summary ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Importa tu colección desde un archivo CSV de Moxfield o Archidekt.
                </p>

                {/* Format selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Formato
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ImportFormat)}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                  >
                    {(Object.keys(FORMAT_LABELS) as ImportFormat[]).map((f) => (
                      <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                    ))}
                  </select>
                </div>

                {/* File picker */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Archivo CSV
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Elegir archivo
                    </button>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                      {selectedFile ? selectedFile.name : 'Ningún archivo seleccionado'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                      aria-label="Archivo CSV para importar"
                    />
                  </div>
                </div>

                {/* Error */}
                {importError && (
                  <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                    {importError}
                  </div>
                )}
              </>
            ) : (
              /* Summary view */
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Importación completada:
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {summary.added}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Añadidas</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {summary.updated}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Actualizadas</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
                    <p className="text-2xl font-bold text-zinc-500 tabular-nums">
                      {summary.skipped}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Omitidas</p>
                  </div>
                </div>

                {summary.errors.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      Errores ({summary.errors.length}):
                    </p>
                    <ul className="max-h-48 overflow-y-auto flex flex-col gap-1">
                      {summary.errors.map((err, i) => (
                        <li
                          key={i}
                          className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded px-2 py-1"
                        >
                          Fila {err.row}: {err.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end gap-2">
            {summary ? (
              <button
                type="button"
                onClick={handleClose}
                className="cursor-pointer rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
              >
                Cerrar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={importing}
                  className="cursor-pointer rounded-md border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!selectedFile || importing}
                  className="cursor-pointer rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {importing && <Spinner size="sm" color="current" />}
                  Importar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
