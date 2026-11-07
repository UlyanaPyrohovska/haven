import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import * as repository from "./repository";
import { recordDecision } from "./service";

vi.mock("./repository", () => ({
	findInteractionBetween: vi.fn(),
	findCandidateCoordinates: vi.fn(async () => null),
	insertInteraction: vi.fn(),
	updateInteraction: vi.fn(),
}));

const db = {} as Db;
const actor = { id: 1, latitude: null, longitude: null };

describe("recordDecision", () => {
	beforeEach(() => vi.clearAllMocks());

	it("matches when the other side's like lands between our read and our insert", async () => {
		// Our read sees no row; the other side's (2 → 1) like is committed before our insert, which then conflicts.
		vi.mocked(repository.findInteractionBetween)
			.mockResolvedValueOnce(null as never)
			.mockResolvedValueOnce({ id: 7, userA: 2, userB: 1, decA: 1, decB: null } as never);
		vi.mocked(repository.insertInteraction).mockResolvedValueOnce(false);

		await expect(recordDecision(db, actor, 2, 1)).resolves.toEqual({ matched: true });
		expect(repository.updateInteraction).toHaveBeenCalledWith(db, 7, { decB: 1, match: true });
	});

	it("records a first like without a match", async () => {
		vi.mocked(repository.findInteractionBetween).mockResolvedValueOnce(null as never);
		vi.mocked(repository.insertInteraction).mockResolvedValueOnce(true);

		await expect(recordDecision(db, actor, 2, 1)).resolves.toEqual({ matched: false });
		expect(repository.updateInteraction).not.toHaveBeenCalled();
	});
});
