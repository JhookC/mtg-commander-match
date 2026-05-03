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
  return null
}

export function shopHomeUrl(sourceName: string): string | null {
  if (sourceName === 'TopCard') return 'https://topcard-tcg.com/'
  if (sourceName === 'Rohan') return 'https://rohanspellbook.com/'
  return null
}
