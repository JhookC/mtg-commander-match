import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// NEVER call vi.useFakeTimers() in tests that touch Dexie.
// Dexie internally uses real timers and fake timers break IndexedDB operations.
// Two safe patterns:
//   (a) Open the DB before enabling fake timers (rare legitimate case).
//   (b) Mock the API/IO layer instead of controlling time (preferred).
// See: sdd/mtg-collection/design §16 (R5, #1076).
