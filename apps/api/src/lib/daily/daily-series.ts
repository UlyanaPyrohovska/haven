/** UTC days from `days - 1` days before `today` up to `today`, as `YYYY-MM-DD`. */
export function lastUtcDays(today: string, days: number): string[] {
	const end = Date.parse(`${today}T00:00:00Z`);

	return Array.from({ length: days }, (_, index) =>
		new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10),
	);
}

/** Per-day counts with missing days filled as 0, oldest first. */
export function fillDailySeries(rows: { day: string; count: number }[], today: string, days: number) {
	const counts = new Map(rows.map((row) => [row.day, row.count]));

	return lastUtcDays(today, days).map((day) => ({ day, count: counts.get(day) ?? 0 }));
}
