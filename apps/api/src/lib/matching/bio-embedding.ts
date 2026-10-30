/** Workers AI bio embeddings (T9). No DB imports: storage is passed in so tests can mock it. */

export const BIO_EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";
/** Matches `user_embeddings.bio vector(384)`. */
export const BIO_EMBEDDING_DIM = 384;
/** bge-small accepts at most 100 texts per call. */
export const BIO_EMBEDDING_BATCH = 100;

export interface BioEmbeddingStore {
	upsert(profileId: number, embedding: number[]): Promise<unknown>;
	remove(profileId: number): Promise<unknown>;
}

export function isBlankBio(bio: string | null | undefined): boolean {
	return !bio?.trim();
}

/** One vector per text, in order. Throws if Workers AI returns anything but 384-d vectors. */
export async function embedTexts(ai: Ai, texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];

	const output = await ai.run(BIO_EMBEDDING_MODEL, { text: texts });
	const data = "data" in output ? output.data : undefined;

	if (!data || data.length !== texts.length || data.some((v) => v.length !== BIO_EMBEDDING_DIM)) {
		throw new Error(`${BIO_EMBEDDING_MODEL} returned unexpected embeddings for ${texts.length} texts`);
	}

	return data;
}

/**
 * Embeds a saved bio, or deletes the vector when the bio was cleared. Never throws: the scorer already
 * treats a missing embedding as neutral, so a failure must not fail the profile save.
 */
export async function syncBioEmbedding(
	ai: Ai,
	store: BioEmbeddingStore,
	profileId: number,
	bio: string | null | undefined,
): Promise<void> {
	try {
		if (isBlankBio(bio)) {
			await store.remove(profileId);
			return;
		}

		const [embedding] = await embedTexts(ai, [bio as string]);
		await store.upsert(profileId, embedding);
	} catch (error) {
		console.error("bio embedding failed", { profileId, error });
	}
}
