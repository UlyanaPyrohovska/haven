import { afterEach, describe, expect, it, vi } from "vitest";
import { BIO_EMBEDDING_DIM, BIO_EMBEDDING_MODEL, embedTexts, syncBioEmbedding } from "./bio-embedding";

const vec = (fill: number, dim = BIO_EMBEDDING_DIM) => Array.from({ length: dim }, () => fill);

function mockAi(run: (model: string, input: { text: string[] }) => Promise<unknown>) {
	return { run: vi.fn(run) } as unknown as Ai & { run: ReturnType<typeof vi.fn> };
}

function mockStore() {
	return { upsert: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("embedTexts", () => {
	it("returns one 384-d vector per text from bge-small", async () => {
		const ai = mockAi(async (_model, input) => ({
			shape: [input.text.length, 384],
			data: input.text.map(() => vec(0.1)),
		}));

		const result = await embedTexts(ai, ["a", "b"]);

		expect(ai.run).toHaveBeenCalledWith(BIO_EMBEDDING_MODEL, { text: ["a", "b"] });
		expect(result).toHaveLength(2);
		expect(result[0]).toHaveLength(BIO_EMBEDDING_DIM);
	});

	it("skips the call for an empty batch", async () => {
		const ai = mockAi(async () => ({ data: [] }));
		expect(await embedTexts(ai, [])).toEqual([]);
		expect(ai.run).not.toHaveBeenCalled();
	});

	it("throws on a wrong dimension or count", async () => {
		await expect(
			embedTexts(
				mockAi(async () => ({ data: [vec(0.1, 768)] })),
				["a"],
			),
		).rejects.toThrow();
		await expect(
			embedTexts(
				mockAi(async () => ({ data: [] })),
				["a"],
			),
		).rejects.toThrow();
	});
});

describe("syncBioEmbedding", () => {
	it("upserts the vector for a bio", async () => {
		const store = mockStore();
		await syncBioEmbedding(
			mockAi(async () => ({ data: [vec(0.2)] })),
			store,
			7,
			"I like hiking",
		);

		expect(store.upsert).toHaveBeenCalledWith(7, vec(0.2));
		expect(store.remove).not.toHaveBeenCalled();
	});

	it("deletes the vector when the bio is cleared, without calling the model", async () => {
		const store = mockStore();
		const ai = mockAi(async () => ({ data: [vec(0.2)] }));

		await syncBioEmbedding(ai, store, 7, null);
		await syncBioEmbedding(ai, store, 8, "   ");

		expect(store.remove.mock.calls).toEqual([[7], [8]]);
		expect(ai.run).not.toHaveBeenCalled();
		expect(store.upsert).not.toHaveBeenCalled();
	});

	it("logs and resolves when Workers AI fails", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const store = mockStore();

		await expect(
			syncBioEmbedding(
				mockAi(async () => {
					throw new Error("3040: capacity");
				}),
				store,
				7,
				"bio",
			),
		).resolves.toBeUndefined();

		expect(store.upsert).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledOnce();
	});

	it("does not store a wrong-dimension vector", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const store = mockStore();

		await syncBioEmbedding(
			mockAi(async () => ({ data: [vec(0.2, 768)] })),
			store,
			7,
			"bio",
		);

		expect(store.upsert).not.toHaveBeenCalled();
	});
});
