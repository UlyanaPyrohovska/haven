import { apiFetch } from "@/lib/api/client";

/** Matches API `DAILY_ANSWER_MAX_LENGTH`. */
export const DAILY_ANSWER_MAX_LENGTH = 150;

export type DailyQuestionToday = {
	question: string;
	answer: string | null;
};

export async function fetchTodayDailyQuestion(): Promise<DailyQuestionToday> {
	const response = await apiFetch("/daily-question/today");

	if (!response.ok) {
		throw new Error(`Failed to load today's question (${response.status})`);
	}

	return response.json();
}

export async function saveTodayDailyQuestion(answer: string): Promise<DailyQuestionToday> {
	const response = await apiFetch("/daily-question/today", {
		method: "PUT",
		body: JSON.stringify({ answer }),
	});

	if (!response.ok) {
		throw new Error(`Failed to save answer (${response.status})`);
	}

	return response.json();
}

export const todayDailyQuestionQueryKey = ["daily-question", "today"] as const;
