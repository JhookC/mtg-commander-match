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
  if (sourceName === 'KartenJager') {
    return `https://kartenjager.co/collections/all-singles?q=${encodeURIComponent(query)}`
  }
  if (sourceName === 'TheVault') {
    return `https://thevaultmtg.com/collections/singles?q=${encodeURIComponent(query)}`
  }
  return null
}

export function shopHomeUrl(sourceName: string): string | null {
  if (sourceName === 'TopCard') return 'https://topcard-tcg.com/'
  if (sourceName === 'Rohan') return 'https://rohanspellbook.com/'
  if (sourceName === 'Draco') return 'https://dracostore.co/catalogo?game=mtg'
  if (sourceName === 'KartenJager') return 'https://kartenjager.co/'
  if (sourceName === 'TheVault') return 'https://thevaultmtg.com/'
  return null
}

export function dracoCardUrl(slug: string): string {
  return `https://dracostore.co/carta/${slug}?game=mtg`
}
