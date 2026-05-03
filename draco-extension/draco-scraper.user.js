// ==UserScript==
// @name         Draco Store — Exportar inventario MTG
// @namespace    mtg-commander-match
// @version      1.0
// @description  Exporta el catálogo MTG de Draco como JSON para importar en la app
// @match        https://dracostore.co/catalogo*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

;(function () {
  'use strict'

  // ── UI ───────────────────────────────────────────────────────────────────

  const btn = document.createElement('button')
  btn.textContent = '⬇ Exportar Draco MTG'
  btn.style.cssText = `
    position:fixed;bottom:20px;right:20px;z-index:99999;
    padding:10px 18px;background:#7c3aed;color:white;
    border:none;border-radius:8px;font-family:monospace;
    font-weight:bold;cursor:pointer;font-size:13px;
    box-shadow:0 4px 16px rgba(0,0,0,0.5);
  `
  document.body.appendChild(btn)

  const statusEl = document.createElement('div')
  statusEl.style.cssText = `
    position:fixed;bottom:64px;right:20px;z-index:99999;
    padding:8px 14px;background:#1a1a2e;color:#aaa;
    border-radius:6px;font-family:monospace;font-size:11px;
    display:none;max-width:280px;line-height:1.4;
  `
  document.body.appendChild(statusEl)

  function setStatus(msg, color) {
    statusEl.style.display = 'block'
    statusEl.style.color = color ?? '#aaa'
    statusEl.textContent = msg
  }

  // ── Parsers ───────────────────────────────────────────────────────────────

  function parseSlug(href) {
    // "/carta/zimone-infinite-analyst-soc-10?game=mtg"
    const slug = href.replace(/^\/carta\//, '').replace(/\?.*$/, '')
    const parts = slug.split('-')
    const collectorNumber = parts.pop() ?? ''
    const setCode = parts.pop() ?? ''
    return { slug, setCode: setCode.toLowerCase(), collectorNumber }
  }

  function parseFinishes(metaText) {
    // "#010 · Foil · No foil · ES"
    const segments = metaText.split('·').map((s) => s.trim().toLowerCase())
    const finishes = []
    if (segments.includes('no foil')) finishes.push('nonfoil')
    if (segments.includes('foil')) finishes.push('foil')
    return finishes.length > 0 ? finishes : ['nonfoil']
  }

  function parseLanguage(metaText) {
    const parts = metaText.split('·')
    return parts[parts.length - 1]?.trim() ?? 'ES'
  }

  function parsePrice(text) {
    // "$3.700 COP" → 3700
    return parseInt(text.replace(/[$\s]|COP|\./g, ''), 10) || 0
  }

  function parseImageUrl(imgEl) {
    if (!imgEl) return null
    const src = imgEl.getAttribute('src') ?? ''
    try {
      const url = new URL(src, 'https://dracostore.co')
      return url.searchParams.get('url') ?? null
    } catch {
      return null
    }
  }

  function parseRarity(el) {
    return (
      Array.from(el.querySelectorAll('span')).find((s) =>
        /^(common|uncommon|rare|mythic rare|special)$/i.test(
          s.textContent?.trim() ?? '',
        ),
      )?.textContent?.trim() ?? ''
    )
  }

  // ── Card extraction ───────────────────────────────────────────────────────

  function parseCards(doc) {
    const cards = []
    // :not(:has(...)) skips container elements that wrap the whole catalog —
    // only leaf card tiles have the attribute without nesting another of the same.
    const cardEls = doc.querySelectorAll(
      '[data-catalog-game="mtg"]:not(:has([data-catalog-game="mtg"]))',
    )

    for (const el of cardEls) {
      const name = el.querySelector('h3')?.textContent?.trim()
      if (!name) continue

      const anchor = el.querySelector('a[href*="/carta/"]')
      if (!anchor) continue
      const { slug, setCode, collectorNumber } = parseSlug(
        anchor.getAttribute('href') ?? '',
      )

      const setName =
        el
          .querySelector('.text-on-surface-variant')
          ?.textContent?.trim() ?? ''

      const metaText =
        el.querySelector('.text-body-fg-muted')?.textContent?.trim() ?? ''

      const priceText = Array.from(el.querySelectorAll('span')).find((s) =>
        /\$[\d.,]+/.test(s.textContent ?? ''),
      )?.textContent?.trim() ?? ''

      const imgEl = el.querySelector('img[data-nimg="fill"]')
      const imageUrl = parseImageUrl(imgEl)

      const addBtn = el.querySelector('button[aria-label^="Agregar"]')
      const inStock = addBtn ? !addBtn.disabled : true

      const finishes = parseFinishes(metaText)
      const language = parseLanguage(metaText)
      const rarity = parseRarity(el)
      const price = parsePrice(priceText)

      for (const finish of finishes) {
        cards.push({
          name,
          setName,
          setCode,
          collectorNumber,
          finish,
          language,
          rarity,
          price,
          imageUrl,
          inStock,
          slug,
        })
      }
    }

    return cards
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  async function fetchPage(page) {
    const res = await fetch(`/catalogo?game=mtg&page=${page}`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    const html = await res.text()
    const parser = new DOMParser()
    return parser.parseFromString(html, 'text/html')
  }

  async function fetchPageWithRetry(page, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const doc = await fetchPage(page)
      if (doc) return doc
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500))
    }
    return null
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = '⏳ Exportando...'
    setStatus('Leyendo página 1...')

    try {
      const allCards = []

      // Page 1: use current DOM (already loaded and Cloudflare-cleared)
      const page1Cards = parseCards(document)
      allCards.push(...page1Cards)

      if (page1Cards.length === 0) {
        setStatus(
          'No se encontraron cartas en la página 1. Asegurate de estar en /catalogo?game=mtg con las cartas visibles.',
          '#ff6b6b',
        )
        return
      }

      setStatus(`Página 1 — ${allCards.length} variantes`)

      // Para cuando 5 páginas consecutivas llegan vacías (con retry x2 por página).
      let currentPage = 2
      let emptyStreak = 0
      while (emptyStreak < 5) {
        setStatus(`Página ${currentPage} — ${allCards.length} variantes...`)
        const doc = await fetchPageWithRetry(currentPage)
        currentPage++
        if (!doc) {
          emptyStreak++
          continue
        }
        const pageCards = parseCards(doc)
        if (pageCards.length === 0) {
          emptyStreak++
          await new Promise((r) => setTimeout(r, 800))
          continue
        }
        emptyStreak = 0
        allCards.push(...pageCards)
        await new Promise((r) => setTimeout(r, 400))
      }

      const totalPages = currentPage - 1

      // Download JSON
      const payload = JSON.stringify(
        { exportedAt: new Date().toISOString(), cards: allCards },
        null,
        2,
      )
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `draco-mtg-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      setStatus(
        `✅ ${allCards.length} variantes exportadas (${totalPages} páginas)`,
        '#6bff6b',
      )
    } catch (err) {
      setStatus(`Error: ${err.message}`, '#ff6b6b')
    } finally {
      btn.disabled = false
      btn.textContent = '⬇ Exportar Draco MTG'
    }
  })
})()
