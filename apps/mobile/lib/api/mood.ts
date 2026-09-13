import { apiFetch } from "@/lib/api/client";
import type { MoodSlug } from "@/lib/mood";

export async function fetchTodayMood(): Promise<{ mood: MoodSlug | null }> {
	const response = await apiFetch("/mood/today");

	if (!response.ok) {
		throw new Error(`Failed to load mood (${response.status})`);
	}

	return response.json();
}

export async function saveTodayMood(mood: MoodSlug): Promise<{ mood: MoodSlug }> {
	const response = await apiFetch("/mood/today", {
		method: "PUT",
		body: JSON.stringify({ mood }),
	});

	if (!response.ok) {
		throw new Error(`Failed to save mood (${response.status})`);
	}

	return response.json();
}

export const todayMoodQueryKey = ["mood", "today"] as const;
