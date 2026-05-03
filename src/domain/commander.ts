export interface Commander {
  /** Scryfall oracle id — stable across reprints. */
  oracleId: string
  name: string
  /** EDHRec slug, e.g. "atraxa-praetors-voice". */
  slug: string
  colorIdentity: string[]
  imageUrl: string | null
  artCropUrl: string | null
  typeLine: string
  manaCost: string | null
  cmc: number | null
  oracleText: string | null
  /** EDHRec popularity rank (lower = more popular). */
  edhrecRank: number | null
}

export interface CommanderSuggestion {
  name: string
  slug: string
  artUrl: string | null
}
