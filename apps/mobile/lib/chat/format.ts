/** Time for today, weekday within a week, otherwise a short date. */
export function formatMessageTime(iso: string, now = new Date()): string {
	const date = new Date(iso);
	const dayMs = 24 * 60 * 60 * 1000;

	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}

	if (now.getTime() - date.getTime() < 6 * dayMs) {
		return date.toLocaleDateString([], { weekday: "short" });
	}

	return date.toLocaleDateString([], { day: "numeric", month: "short" });
}
