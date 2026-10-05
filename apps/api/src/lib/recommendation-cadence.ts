import { CADENCE } from "@/lib/scoring";

export { CADENCE };

export function resolveRecCooldownHours(raw: string | undefined): number {
	if (raw == null || raw.trim() === "") {
		return CADENCE.cooldownHours;
	}

	const parsed = Number(raw);

	if (!Number.isFinite(parsed) || parsed < 0) {
		return CADENCE.cooldownHours;
	}

	return parsed;
}

export function cooldownMs(hours: number): number {
	return hours * 3_600_000;
}

/** Neon/pg often return timestamps as strings; normalize before arithmetic. */
export function coerceLastShownAt(value: Date | string | null | undefined): Date | null {
	if (value == null) {
		return null;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	const parsed = new Date(value);

	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nextRefreshAtIso(lastShown: Date | string, cooldownHours: number): string {
	const at = coerceLastShownAt(lastShown);

	if (!at) {
		throw new Error("Invalid lastShown timestamp");
	}

	return new Date(at.getTime() + cooldownMs(cooldownHours)).toISOString();
}

export function isCooldownElapsed(lastShown: Date | string | null, cooldownHours: number, nowMs = Date.now()): boolean {
	const at = coerceLastShownAt(lastShown);

	if (!at) {
		return true;
	}

	return nowMs - at.getTime() >= cooldownMs(cooldownHours);
}
