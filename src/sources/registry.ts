import type { CardSource } from './CardSource'
import { rohanSource } from './rohan/RohanSource'
import { topcardSource } from './topcard/TopcardSource'
import { dracoSource } from './draco/DracoSource'
import { kartenJagerSource } from './kartenjager/KartenJagerSource'
import { theVaultSource } from './thevault/TheVaultSource'

/**
 * Active sources. To add a new store: implement CardSource and append it here.
 * That's the only file you have to touch.
 */
export const sources: CardSource[] = [
  rohanSource,
  topcardSource,
  dracoSource,
  kartenJagerSource,
  theVaultSource,
]
