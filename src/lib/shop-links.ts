export function shopSearchUrl(
  sourceName: string,
  query: string,
): string | null {
  if (sourceName === 'TopCard') {
    return `https://topcard-tcg.com/search?q=${encodeURIComponent(query)}`
  }
  if (sourceName === 'Rohan') {
    return 'https://rohanspellbook.com/'
  }
  if (sourceName === 'Draco') {
    return `https://dracostore.co/catalogo?game=mtg&search=${encodeURIComponent(query)}`
  }
  return null
}

export function shopHomeUrl(sourceName: string): string | null {
  if (sourceName === 'TopCard') return 'https://topcard-tcg.com/'
  if (sourceName === 'Rohan') return 'https://rohanspellbook.com/'
  if (sourceName === 'Draco') return 'https://dracostore.co/catalogo?game=mtg'
  return null
}

export function dracoCardUrl(slug: string): string {
  return `https://dracostore.co/carta/${slug}?game=mtg`
}
