/**
 * Deterministic avatar URLs from curated Unsplash portrait photos.
 * Used when `user_profiles.photo_url` is null.
 */

const UNSPLASH_IMAGE_BASE = "https://images.unsplash.com";

const FEMALE_PORTRAITS = [
	"photo-1494790108377-be9c29b29330",
	"photo-1438761681033-6461ffad8d80",
	"photo-1544005313-94ddf0286df2",
	"photo-1534528741775-53994a69daeb",
	"photo-1524504388940-b1c1722653e1",
	"photo-1517841905240-472988babdf9",
	"photo-1487412720507-e7ab37603c6f",
	"photo-1489424731088-a5d8b2193775",
	"photo-1529626455594-4ff0802cfb7e",
	"photo-1531746020758-e7763a404329",
	"photo-1508214751196-bcfd4ca60f91",
	"photo-1522075469751-3a6694fb2f61",
] as const;

const MALE_PORTRAITS = [
	"photo-1507003211169-0a1dd7228f2d",
	"photo-1500648767791-00dcc994a43e",
	"photo-1506794778202-cad84cf45f1d",
	"photo-1519345182560-3f2917c472ef",
	"photo-1472099645785-5658abf4ff4e",
	"photo-1560250097-0b93528c311a",
	"photo-1552058544-f228b0847218",
	"photo-1573496359142-b8d87734a5a2",
	"photo-1519085369753-2e2f0f2315c7",
	"photo-1504257432387-305f79f98635",
	"photo-1463453091185-820ea4a55618",
	"photo-1539571696357-5a69c17a67c6",
] as const;

export type AvatarProfile = {
	id: number;
	gender?: number | null;
};

/** Stable index for picking portrait/name variants from a profile id. */
export function hashIndex(seed: number, length: number): number {
	let hash = seed | 0;

	hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
	hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
	hash ^= hash >>> 16;

	return Math.abs(hash) % length;
}

export function avatarUrlForProfile(profile: AvatarProfile): string {
	const pool = profile.gender === 1 ? MALE_PORTRAITS : FEMALE_PORTRAITS;
	const slug = pool[hashIndex(profile.id, pool.length)];

	return `${UNSPLASH_IMAGE_BASE}/${slug}?w=640&h=800&fit=crop&crop=faces&auto=format&q=80`;
}

export function resolveProfilePhotoUrl(candidate: AvatarProfile & { photoUrl?: unknown }): string {
	const stored = typeof candidate.photoUrl === "string" ? candidate.photoUrl.trim() : "";

	return stored || avatarUrlForProfile(candidate);
}
