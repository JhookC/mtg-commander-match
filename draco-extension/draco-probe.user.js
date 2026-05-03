// ==UserScript==
// @name         Draco Store — Probe (diagnóstico)
// @namespace    mtg-commander-match
// @version      1.0
// @description  Detecta la estructura del catálogo de Draco para construir el scraper final
// @match        https://dracostore.co/catalogo*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

;(function () {
  'use strict'

  function probe() {
    // Intentar detectar elementos que parecen cartas
    // Buscamos elementos que contengan precio (formato COP: $15.000 o 15000)
    const pricePattern = /\$[\d.,]+|[\d.]+/

    // Candidatos: elementos con texto que matchee precio
    const allElements = Array.from(document.querySelectorAll('*'))

    const priceEls = allElements.filter((el) => {
      if (el.children.length > 5) return false // no contenedores grandes
      const text = el.textContent?.trim() ?? ''
      return pricePattern.test(text) && text.length < 30
    })

    // Para cada elemento con precio, subir hasta encontrar la "tarjeta"
    const cards = new Set()
    for (const el of priceEls.slice(0, 5)) {
      let node = el
      for (let i = 0; i < 6; i++) {
        if (!node.parentElement) break
        node = node.parentElement
        const tag = node.tagName.toLowerCase()
        if (['li', 'article', 'section', 'div'].includes(tag)) {
          cards.add(node)
          break
        }
      }
    }

    const cardArray = Array.from(cards).slice(0, 3)

    if (cardArray.length === 0) {
      console.warn('[Draco Probe] No se encontraron candidatos a tarjeta. Revisá si la página cargó completamente.')
      return
    }

    const output = cardArray.map((el, i) => {
      return `\n\n--- Candidato ${i + 1} ---\nTag: ${el.tagName}\nClass: ${el.className}\nHTML:\n${el.outerHTML.slice(0, 1500)}`
    }).join('')

    console.group('[Draco Probe] Estructura detectada')
    console.log(output)
    console.groupEnd()

    // Crear overlay visual
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 99999;
      background: #1a1a2e; color: #e0e0e0; font-family: monospace;
      font-size: 11px; padding: 12px 16px; border-radius: 8px;
      border: 1px solid #4a4a8a; max-width: 340px; max-height: 260px;
      overflow: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `
    overlay.innerHTML = `
      <div style="font-weight:bold;color:#7b7bff;margin-bottom:8px">
        🔍 Draco Probe — ${cardArray.length} candidato(s) detectados
      </div>
      <div style="color:#aaa;margin-bottom:6px">Revisá la consola (F12) para ver el HTML completo.</div>
      <div style="color:#888;font-size:10px">
        Copiá el output de la consola y pasáselo al asistente.
      </div>
      <button id="draco-close" style="
        margin-top:10px; padding:4px 12px; background:#4a4a8a;
        border:none; color:white; border-radius:4px; cursor:pointer;
      ">Cerrar</button>
    `
    document.body.appendChild(overlay)
    document.getElementById('draco-close')?.addEventListener('click', () => overlay.remove())
  }

  // Esperar a que React hidrate el DOM
  if (document.readyState === 'complete') {
    setTimeout(probe, 2000)
  } else {
    window.addEventListener('load', () => setTimeout(probe, 2000))
  }
})()
