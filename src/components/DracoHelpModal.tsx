import { useState } from 'react'
import dracoScript from '../../draco-extension/draco-scraper.user.js?raw'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const STEPS = [
  {
    n: 1,
    title: 'Instalar Tampermonkey',
    body: (
      <>
        Instalá{' '}
        <a
          href="https://www.tampermonkey.net/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-zinc-900 dark:text-zinc-100 hover:opacity-70"
        >
          Tampermonkey
        </a>{' '}
        en Chrome o Firefox (es gratis).
      </>
    ),
  },
  {
    n: 2,
    title: 'Agregar el script',
    body: 'Abrí el Dashboard de Tampermonkey → click en "+" → borrá el contenido default → pegá el script de abajo → Ctrl+S para guardar.',
  },
  {
    n: 3,
    title: 'Exportar el inventario',
    body: 'Andá a dracostore.co/catalogo?game=mtg. Aparece un botón "⬇ Exportar Draco MTG" abajo a la derecha. Hacé click — pagina automáticamente y descarga el archivo JSON.',
  },
  {
    n: 4,
    title: 'Importar acá',
    body: 'Volvé a esta app y usá el botón "Importar JSON" para cargar el archivo. Las cartas de Draco aparecen en los resultados de búsqueda.',
  },
  {
    n: 5,
    title: 'Mantenerlo actualizado',
    body: 'Repetí los pasos 3 y 4 cuando quieras actualizar el inventario (por ejemplo, una vez por semana).',
  },
]

export function DracoHelpModal({ isOpen, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  async function copyScript() {
    await navigator.clipboard.writeText(dracoScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cómo usar Draco"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Cómo usar Draco Store
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                El inventario se exporta con un script y se importa una vez
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            {/* Steps */}
            <ol className="flex flex-col gap-3">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-3">
                  <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold mt-0.5">
                    {step.n}
                  </span>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {step.title}
                      {' — '}
                    </span>
                    {step.body}
                  </div>
                </li>
              ))}
            </ol>

            {/* Script block */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Script para Tampermonkey
                </span>
                <button
                  type="button"
                  onClick={copyScript}
                  className="cursor-pointer rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {copied ? '✓ Copiado' : 'Copiar script'}
                </button>
              </div>
              <pre className="rounded-lg bg-zinc-950 dark:bg-zinc-950 border border-zinc-800 p-3 text-[10px] text-zinc-300 overflow-auto max-h-56 leading-relaxed font-mono whitespace-pre">
                {dracoScript}
              </pre>
            </div>

            {/* Note */}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-200 dark:border-zinc-700 pt-4">
              <strong className="text-zinc-700 dark:text-zinc-300">Nota:</strong>{' '}
              Draco no tiene una API pública — el script corre en tu browser
              (mismo origen) para poder leer el catálogo. El inventario importado
              queda guardado localmente; nadie más tiene acceso a él.
            </p>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
