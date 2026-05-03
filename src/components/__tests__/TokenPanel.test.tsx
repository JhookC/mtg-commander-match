/**
 * TokenPanel.test.tsx — Smoke tests for TokenPanel.
 *
 * Tests: no tokens state, have/missing rendering.
 * NEVER uses vi.useFakeTimers().
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	closeAndDelete,
	freshCollectionDb,
} from "../../lib/__tests__/db-helpers";
import {
	FIXTURE_CARD_SAPROLING_TOKEN,
	FIXTURE_CARD_TENDERSHOOT_DRYAD,
} from "../../lib/__tests__/fixtures";
import { CollectionProvider } from "../../lib/collection";
import type { CollectionDb } from "../../lib/collection-db";
import { TokenPanel } from "../TokenPanel";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testDb: CollectionDb;

afterEach(async () => {
	cleanup();
	vi.restoreAllMocks();
	if (testDb) {
		await new Promise<void>((resolve) => setTimeout(resolve, 20));
		await closeAndDelete(testDb);
	}
});

function renderWithProvider(children: ReactNode, db: CollectionDb) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	// Stub fetch so TokenItem's image query doesn't hit the network
	vi.spyOn(globalThis, "fetch").mockResolvedValue(
		new Response(JSON.stringify({ image_uris: { normal: "" } }), {
			status: 200,
		}),
	);
	return render(
		<QueryClientProvider client={qc}>
			<CollectionProvider db={db}>{children}</CollectionProvider>
		</QueryClientProvider>,
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TokenPanel — no tokens", () => {
	it("shows no-tokens message when deck has no token-producing cards", async () => {
		testDb = await freshCollectionDb();

		const deckId = (await testDb.decks.add({
			name: "Empty Deck",
			commanderId: "some-uuid",
			format: "commander",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})) as number;

		renderWithProvider(<TokenPanel deckId={deckId} />, testDb);

		await waitFor(() => {
			expect(
				screen.getByText("Este mazo no produce tokens."),
			).toBeInTheDocument();
		});
	});
});

describe("TokenPanel — missing tokens", () => {
	it("shows token in Te faltan when token is not owned", async () => {
		testDb = await freshCollectionDb();

		// Store cards
		await testDb.cards.bulkPut([
			{ ...FIXTURE_CARD_TENDERSHOOT_DRYAD, cachedAt: Date.now() },
			{ ...FIXTURE_CARD_SAPROLING_TOKEN, cachedAt: Date.now() },
		]);

		// Create deck
		const deckId = (await testDb.decks.add({
			name: "Saproling Deck",
			commanderId: "commander-uuid",
			format: "commander",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})) as number;

		// Add Tendershoot Dryad to deck (produces Saproling token)
		await testDb.deckCards.add({
			deckId,
			cardId: FIXTURE_CARD_TENDERSHOOT_DRYAD.id,
			quantity: 1,
			category: "mainboard",
			addedAt: Date.now(),
		});

		// Do NOT add Saproling token to collection — should show as missing

		renderWithProvider(<TokenPanel deckId={deckId} />, testDb);

		await waitFor(
			() => {
				expect(screen.getByText("Saproling")).toBeInTheDocument();
			},
			{ timeout: 3000 },
		);

		// The Saproling should appear in missing section (✗)
		expect(screen.getByLabelText("Te falta este token")).toBeInTheDocument();
	});
});

describe("TokenPanel — owned tokens", () => {
	it("shows token in Tienes when token is owned", async () => {
		testDb = await freshCollectionDb();

		// Store cards
		await testDb.cards.bulkPut([
			{ ...FIXTURE_CARD_TENDERSHOOT_DRYAD, cachedAt: Date.now() },
			{ ...FIXTURE_CARD_SAPROLING_TOKEN, cachedAt: Date.now() },
		]);

		// Create deck
		const deckId = (await testDb.decks.add({
			name: "Saproling Deck",
			commanderId: "commander-uuid",
			format: "commander",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})) as number;

		// Add Tendershoot Dryad to deck
		await testDb.deckCards.add({
			deckId,
			cardId: FIXTURE_CARD_TENDERSHOOT_DRYAD.id,
			quantity: 1,
			category: "mainboard",
			addedAt: Date.now(),
		});

		// Add Saproling token to collection — should show as owned
		const now = Date.now();
		await testDb.collection.add({
			cardId: FIXTURE_CARD_SAPROLING_TOKEN.id,
			finish: "nonfoil" as const,
			condition: "NM" as const,
			quantity: 3,
			forTrade: false,
			language: "en",
			addedAt: now,
			updatedAt: now,
		});

		renderWithProvider(<TokenPanel deckId={deckId} />, testDb);

		await waitFor(
			() => {
				expect(screen.getByText("Saproling")).toBeInTheDocument();
			},
			{ timeout: 3000 },
		);

		// Should show as owned (✓)
		expect(screen.getByLabelText("Tienes este token")).toBeInTheDocument();

		// "Tenés todos los tokens para este mazo." message
		expect(screen.getByText(/Tenés todos los tokens/i)).toBeInTheDocument();
	});
});
