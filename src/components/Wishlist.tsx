import { useEffect, useMemo, useRef, useState } from 'react'
import { Spinner } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import type { WishlistItem } from '../domain/wishlist'
import { useWishlist } from '../lib/wishlist-context'
import { useImagePreview } from '../lib/preview-context'
import { formatPrice } from '../lib/format'
import { shopHomeUrl } from '../lib/shop-links'
import { buildTopcardCartPayload } from '../sources/topcard/TopcardSource'
import { buildSpellbookCartPayload } from '../sources/rohan/RohanSource'
import { exportToJson, importFromJson, isAvailable } from '../lib/wishlist-io'
import { useStockCatalogs } from '../lib/use-stock-catalogs'

const TOPCARD_BOOKMARKLET = `javascript:(async()=>{try{const t=await navigator.clipboard.readText();JSON.parse(t);localStorage.setItem('shopping_cart',t);location.reload()}catch(e){alert('No se pudo cargar el carrito: '+e.message)}})()`
const ROHAN_BOOKMARKLET = `javascript:(async()=>{try{const t=await navigator.clipboard.readText();JSON.parse(t);localStorage.setItem('cart',t);location.reload()}catch(e){alert('No se pudo cargar el carrito: '+e.message)}})()`

interface ShopTransferConfig {
  shop: string
  url: string
  build: (items: WishlistItem[]) => string | null
  bookmarklet: string
}

const SHOP_TRANSFERS: Record<string, ShopTransferConfig> = {
  TopCard: {
    shop: 'TopCard',
    url: 'https://topcard-tcg.com/',
    build: buildTopcardCartPayload,
    bookmarklet: TOPCARD_BOOKMARKLET,
  },
  Rohan: {
    shop: 'Rohan',
    url: 'https://rohanspellbook.com/',
    build: buildSpellbookCartPayload,
    bookmarklet: ROHAN_BOOKMARKLET,
  },
}

interface ShopGroup {
  shop: string
  items: WishlistItem[]
  total: number
  currency: string
}

function groupByShop(items: WishlistItem[]): ShopGroup[] {
  const map = new Map<string, ShopGroup>()
  for (const it of items) {
    const existing = map.get(it.sourceName)
    if (existing) {
      existing.items.push(it)
      existing.total += it.price * it.qty
    } else {
      map.set(it.sourceName, {
        shop: it.sourceName,
        items: [it],
        total: it.price * it.qty,
        currency: it.currency,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.shop.localeCompare(b.shop))
}

function buildShopList(items: WishlistItem[]): string {
  return items.map((it) => `${it.qty} ${it.displayName}`).join('\n')
}

export function Wishlist() {
  const { items, count, total, remove, setQty, clear, replaceAll } =
    useWishlist()
  const setPreview = useImagePreview()
  const [open, setOpen] = useState(false)
  const [copiedShop, setCopiedShop] = useState<string | null>(null)
  const [transferStatus, setTransferStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importStage, setImportStage] = useState<string>('')
  const [importCancelled, setImportCancelled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // React 16.9+ blocks `javascript:` URLs in href props as an XSS precaution.
  // We need draggable <a> tags with real javascript: hrefs so the user can
  // bookmark them. Bypass React's sanitization by rendering as raw HTML —
  // bookmarklet contents are constants, not user input.
  function bookmarkletHtml(label: string, href: string): string {
    return `<a class="cursor-grab rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 select-none inline-block" draggable="true" title="Arrastrar a la barra de favoritos" href="${href}">${label}</a>`
  }

  const catalogsQuery = useStockCatalogs(open && items.length > 0)

  const groups = useMemo(() => groupByShop(items), [items])
  const currency = items[0]?.currency ?? 'COP'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleExport() {
    const json = exportToJson(items)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `mtg-wishlist-${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleCancelImport() {
    setImportCancelled(true)
    queryClient.cancelQueries({ queryKey: ['allStockCatalogs'] })
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setImporting(true)
    setImportCancelled(false)
    setImportStage('Leyendo archivo…')
    try {
      const text = await file.text()
      if (importCancelled) return
      let catalogs = catalogsQuery.data
      if (!catalogs) {
        setImportStage('Cargando inventario…')
        const refetched = await catalogsQuery.refetch()
        catalogs = refetched.data
      }
      if (!catalogs) return
      setImportStage('Importando…')
      const result = importFromJson(text, catalogs)
      replaceAll(result.imported)
      const detail =
        result.unavailable > 0
          ? `${result.matched} disponibles, ${result.unavailable} sin stock actual (se muestran en gris).`
          : `${result.matched} cartas importadas.`
      setTransferStatus(detail)
      setTimeout(() => setTransferStatus(null), 6000)
    } catch (err) {
      if (importCancelled) return
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'CancelledError')
      if (isAbort) return
      const msg = err instanceof Error ? err.message : 'Error al importar.'
      window.alert(`No se pudo importar: ${msg}`)
    } finally {
      setImporting(false)
      setImportStage('')
      setImportCancelled(false)
    }
  }

  async function copyShopList(group: ShopGroup) {
    const text = buildShopList(group.items)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedShop(group.shop)
      setTimeout(() => setCopiedShop(null), 1800)
    } catch {
      window.prompt('Copia esta lista:', text)
    }
  }

  async function transferToShop(group: ShopGroup) {
    const config = SHOP_TRANSFERS[group.shop]
    if (!config) return
    const eligible = group.items.filter((it) => it.sourceMeta)
    const missing = group.items.length - eligible.length

    if (eligible.length === 0) {
      window.alert(
        'Tu lista actual fue creada antes de la última actualización y no tiene los datos necesarios para transferir.\n\n' +
          'Solución: exportá la lista (↓ Exportar), volvé a importarla (↑ Importar). La próxima transferencia va a funcionar.',
      )
      return
    }

    const payload = config.build(group.items)
    if (!payload) {
      window.alert(
        'No se pudo construir el payload del carrito. Revisa la consola.',
      )
      return
    }

    try {
      await navigator.clipboard.writeText(payload)
      window.open(config.url, '_blank', 'noopener,noreferrer')
      const detail =
        missing > 0 ? `${missing} carta(s) viejas no se transfieren. ` : ''
      setTransferStatus(
        `${detail}Lista copiada al portapapeles. En ${config.shop}, click el bookmarklet desde tu barra de favoritos.`,
      )
      setTimeout(() => setTransferStatus(null), 10000)
    } catch (err) {
      console.error('[Wishlist] Clipboard write failed:', err)
      const proceed = window.confirm(
        'No se pudo copiar al clipboard automáticamente. ¿Mostrar el JSON para copiar manualmente?',
      )
      if (proceed) {
        window.prompt(
          `Copia este JSON, después usá el bookmarklet en ${config.shop}:`,
          payload,
        )
      }
    }
  }


  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-zinc-800"
        aria-label={`Mi lista (${count})`}
      >
        <span aria-hidden>🛒</span>
        <span>Mi lista</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-900 tabular-nums">
          {count}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-md flex flex-col bg-white border-l border-zinc-200 shadow-2xl text-zinc-900 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mi lista de compras"
          >
            <header className="flex items-center justify-between p-4 border-b border-zinc-200">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Mi lista
                </h2>
                <p className="text-xs text-zinc-500">
                  {count} {count === 1 ? 'carta' : 'cartas'} ·{' '}
                  {formatPrice(total, currency)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={importing}
                  className="cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Importar lista desde un archivo JSON"
                >
                  ↑ Importar
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={items.length === 0 || importing}
                  className="cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Exportar lista a archivo JSON"
                >
                  ↓ Exportar
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={importing}
                  className="cursor-pointer rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 ml-1 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </header>
            {importing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm p-6">
                <div className="w-full max-w-xs flex flex-col gap-4 text-zinc-900">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" color="current" />
                    <p className="text-sm font-medium">
                      {importStage || 'Importando lista…'}
                    </p>
                  </div>
                  {catalogsQuery.progress && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full bg-zinc-900 transition-all"
                            style={{
                              width: `${Math.round(
                                catalogsQuery.progress.ratio * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="text-right text-xs text-zinc-500 tabular-nums">
                          {Math.round(catalogsQuery.progress.ratio * 100)}%
                        </div>
                      </div>
                      <details className="text-xs text-zinc-500 group">
                        <summary className="cursor-pointer hover:text-zinc-700 list-none [&::-webkit-details-marker]:hidden flex items-center gap-1 select-none">
                          <span className="group-open:rotate-90 transition-transform">
                            ▶
                          </span>
                          <span>Detalle por tienda</span>
                        </summary>
                        <div className="mt-2 flex flex-col gap-0.5 pl-4">
                          {Object.entries(catalogsQuery.progress.bySource).map(
                            ([name, p]) => (
                              <div
                                key={name}
                                className="flex items-center justify-between"
                              >
                                <span>{name}</span>
                                <span className="tabular-nums">
                                  {p.loaded}/{p.total}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </details>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelImport}
                    className="cursor-pointer self-start rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-zinc-50">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Tu lista está vacía. Agrega cartas desde los resultados con el
                  botón <span className="font-mono">+</span>.
                </div>
              ) : (
                <div className="p-4 flex flex-col gap-6">
                  {groups.map((group) => {
                    const homeUrl = shopHomeUrl(group.shop)
                    return (
                      <section key={group.shop}>
                        <div className="flex items-baseline justify-between mb-2">
                          <h3 className="text-sm font-semibold text-zinc-900">
                            {group.shop}
                          </h3>
                          <span className="text-xs text-zinc-500">
                            {group.items.length}{' '}
                            {group.items.length === 1 ? 'carta' : 'cartas'} ·{' '}
                            {formatPrice(group.total, group.currency)}
                          </span>
                        </div>
                        <ul className="flex flex-col gap-2">
                          {group.items.map((it) => {
                            const available = isAvailable(
                              it,
                              catalogsQuery.data?.get(it.sourceName),
                            )
                            return (
                            <li
                              key={it.id}
                              className={
                                'flex items-start gap-3 rounded-md border border-zinc-200 bg-white p-2 transition-opacity ' +
                                (available ? '' : 'opacity-50')
                              }
                              title={
                                available
                                  ? undefined
                                  : 'Sin stock actual en esta tienda'
                              }
                            >
                              {it.imageUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreview(it.imageUrl)}
                                  className="cursor-zoom-in flex-shrink-0"
                                  aria-label="Ver carta en grande"
                                >
                                  <img
                                    src={it.imageUrl}
                                    alt=""
                                    className="w-10 h-14 rounded object-cover bg-zinc-100"
                                    loading="lazy"
                                  />
                                </button>
                              ) : (
                                <div className="w-10 h-14 rounded bg-zinc-100 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-zinc-900">
                                      {it.displayName}
                                    </p>
                                    <p className="truncate text-xs text-zinc-500 mt-0.5">
                                      {it.setCode.toUpperCase()} · #
                                      {it.collectorNumber} · {it.finish} ·{' '}
                                      {it.condition}
                                      {!available && (
                                        <>
                                          {' · '}
                                          <span className="text-amber-700 font-medium">
                                            Sin stock
                                          </span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-1 flex-shrink-0">
                                    <span className="text-sm font-semibold tabular-nums text-zinc-900">
                                      {formatPrice(
                                        it.price * it.qty,
                                        it.currency,
                                      )}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => remove(it.id)}
                                      className="cursor-pointer -mr-1 -mt-1 rounded p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 leading-none"
                                      aria-label="Quitar de la lista"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setQty(it.id, it.qty - 1)}
                                    className="cursor-pointer w-6 h-6 rounded border border-zinc-300 text-zinc-700 hover:bg-zinc-100 text-sm leading-none"
                                    aria-label="Disminuir cantidad"
                                  >
                                    −
                                  </button>
                                  <span className="w-6 text-center text-sm tabular-nums text-zinc-900">
                                    {it.qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setQty(it.id, it.qty + 1)}
                                    className="cursor-pointer w-6 h-6 rounded border border-zinc-300 text-zinc-700 hover:bg-zinc-100 text-sm leading-none"
                                    aria-label="Aumentar cantidad"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </li>
                            )
                          })}
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {SHOP_TRANSFERS[group.shop] ? (
                            <>
                              <button
                                type="button"
                                onClick={() => transferToShop(group)}
                                className="cursor-pointer flex-1 min-w-[160px] rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
                              >
                                🚀 Cargar lista en {group.shop}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyShopList(group)}
                                className={
                                  'cursor-pointer min-w-[120px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium transition-colors ' +
                                  (copiedShop === group.shop
                                    ? 'text-emerald-600'
                                    : 'text-zinc-700 hover:bg-zinc-50')
                                }
                              >
                                {copiedShop === group.shop
                                  ? '✓ Copiado'
                                  : '📋 Copiar nombres'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => copyShopList(group)}
                                className={
                                  'cursor-pointer flex-1 min-w-[140px] rounded-md px-3 py-2 text-xs font-medium transition-colors ' +
                                  (copiedShop === group.shop
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-zinc-900 text-white hover:bg-zinc-800')
                                }
                              >
                                {copiedShop === group.shop
                                  ? '✓ Lista copiada'
                                  : '📋 Copiar nombres'}
                              </button>
                              {homeUrl && (
                                <a
                                  href={homeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 min-w-[140px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-center text-xs font-medium text-zinc-900 hover:bg-zinc-50"
                                >
                                  Abrir {group.shop} ↗
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </section>
                    )
                  })}
                  {groups.some((g) => SHOP_TRANSFERS[g.shop]) && (
                    <details className="rounded-md border border-zinc-200 bg-white p-3 text-xs">
                      <summary className="cursor-pointer font-medium text-zinc-700 list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
                        <span className="group-open:rotate-90 transition-transform">
                          ▶
                        </span>
                        <span>
                          ¿Primera vez? Configurá los bookmarklets
                        </span>
                      </summary>
                      <div className="mt-3 flex flex-col gap-2 text-zinc-600">
                        <ol className="list-decimal pl-5 space-y-2">
                          <li>
                            <span className="font-medium text-zinc-900">
                              Mostrá la barra de favoritos del browser
                            </span>{' '}
                            si aún no está visible:{' '}
                            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono">
                              ⌘
                            </kbd>{' '}
                            +{' '}
                            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono">
                              ⇧
                            </kbd>{' '}
                            +{' '}
                            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono">
                              B
                            </kbd>{' '}
                            (Mac) o{' '}
                            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono">
                              Ctrl
                            </kbd>{' '}
                            +{' '}
                            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono">
                              Shift
                            </kbd>{' '}
                            +{' '}
                            <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono">
                              B
                            </kbd>{' '}
                            (Windows/Linux).
                          </li>
                          <li>
                            <span className="font-medium text-zinc-900">
                              Arrastrá los botones
                            </span>{' '}
                            de abajo hacia esa barra de favoritos. Si los
                            arrastrás bien, aparecen como nuevos marcadores —
                            uno por tienda.
                          </li>
                        </ol>
                        <div className="flex flex-wrap justify-center gap-2 py-2">
                          {Object.values(SHOP_TRANSFERS).map((cfg) => (
                            <div
                              key={cfg.shop}
                              dangerouslySetInnerHTML={{
                                __html: bookmarkletHtml(
                                  `🛒 Cargar lista ${cfg.shop}`,
                                  cfg.bookmarklet,
                                ),
                              }}
                            />
                          ))}
                        </div>
                        <ol
                          start={3}
                          className="list-decimal pl-5 space-y-1"
                        >
                          <li>
                            Acá click en{' '}
                            <span className="font-medium text-zinc-900">
                              🚀 Cargar lista en TopCard
                            </span>
                            . Se copia tu lista al portapapeles y se abre
                            TopCard en una pestaña nueva.
                          </li>
                          <li>
                            En la pestaña de la tienda, hacé click en el
                            bookmarklet correspondiente desde tu barra de
                            favoritos.
                          </li>
                          <li>
                            El carrito real de la tienda queda cargado con todas
                            las cartas.
                          </li>
                        </ol>
                        <p className="text-zinc-500 mt-2">
                          Cada bookmarklet lee del portapapeles, escribe el
                          carrito al localStorage de su tienda y recarga la
                          página. Como esta app vive en otro dominio, no puede
                          escribir directo en el localStorage de las tiendas —
                          por eso el rodeo.
                        </p>
                      </div>
                    </details>
                  )}
                  {transferStatus && (
                    <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                      {transferStatus}
                    </div>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <footer className="flex items-center justify-between border-t border-zinc-200 bg-white p-4">
                <div>
                  <p className="text-xs text-zinc-500">Total</p>
                  <p className="text-lg font-semibold text-zinc-900 tabular-nums">
                    {formatPrice(total, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Vaciar toda la lista?')) clear()
                  }}
                  className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-red-600"
                >
                  Vaciar lista
                </button>
              </footer>
            )}
          </aside>
        </>
      )}
    </>
  )
}
