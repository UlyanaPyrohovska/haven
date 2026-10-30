/**
 * Deterministic avatar URLs from curated Unsplash portrait photos.
 * Used when `user_profiles.photo_url` is null.
 * Every slug was checked by eye to match its pool's gender and to resolve (200) on images.unsplash.com.
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
	"photo-1529626455594-4ff0802cfb7e",
	"photo-1508214751196-bcfd4ca60f91",
	"photo-1522075469751-3a6694fb2f61",
	"photo-1580489944761-15a19d654956",
] as const;

const MALE_PORTRAITS = [
	"photo-1507003211169-0a1dd7228f2d",
	"photo-1500648767791-00dcc994a43e",
	"photo-1506794778202-cad84cf45f1d",
	"photo-1519345182560-3f2917c472ef",
	"photo-1472099645785-5658abf4ff4e",
	"photo-1560250097-0b93528c311a",
	"photo-1539571696357-5a69c17a67c6",
	"photo-1527980965255-d3b416303d12",
	"photo-1531427186611-ecfd6d936c79",
	"photo-1568602471122-7832951cc4c5",
	"photo-1570295999919-56ceb5ecca61",
	"photo-1599566150163-29194dcaad36",
	"photo-1633332755192-727a05c4013d",
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
