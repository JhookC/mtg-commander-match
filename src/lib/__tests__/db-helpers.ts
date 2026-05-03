/**
 * db-helpers.ts — Test helpers for Dexie-based tests.
 *
 * NEVER call vi.useFakeTimers() in any test file that uses these helpers.
 * Dexie relies on real timer internals; fake timers break IndexedDB operations.
 */

import Dexie from 'dexie'
import { CollectionDb } from '../collection-db'

/**
 * Returns a fresh, open CollectionDb instance with no data.
 * Deletes the existing database first to ensure full isolation between tests.
 */
export async function freshCollectionDb(): Promise<CollectionDb> {
  await Dexie.delete('mtg-collection-v1')
  const freshDb = new CollectionDb()
  await freshDb.open()
  return freshDb
}

/**
 * Closes and deletes the given database.
 * Call in afterEach to avoid leaving open handles.
 */
export async function closeAndDelete(database: Dexie): Promise<void> {
  database.close()
  await Dexie.delete(database.name)
}

/** Returns the current Unix ms timestamp. Useful for test data. */
export function now(): number {
  return Date.now()
}
