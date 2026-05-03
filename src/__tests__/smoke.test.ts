import Dexie, { type Table } from 'dexie'

// Trivial assertion — verifies Vitest is wired up.
test('arithmetic works', () => {
  expect(1 + 1).toBe(2)
})

// Verify fake-indexeddb/auto polyfill works with Dexie.
test('Dexie opens via fake-indexeddb', async () => {
  class SmokeDb extends Dexie {
    items!: Table<{ id?: number; name: string }, number>

    constructor() {
      super('smoke-test-db')
      this.version(1).stores({ items: '++id, name' })
    }
  }

  const db = new SmokeDb()
  await db.open()

  const id = await db.items.add({ name: 'test' })
  const item = await db.items.get(id)
  expect(item?.name).toBe('test')

  await db.close()
  await Dexie.delete('smoke-test-db')
})
