import { describe, expect, it } from "vitest";
import { DAILY_QUESTIONS, dailyQuestion, dailyQuestionIndex, dayOfYearUtc } from "@/lib/daily-questions";

describe("dailyQuestion", () => {
	it("indexes by UTC day-of-year into the question pool", () => {
		const index = dayOfYearUtc("2026-03-01") % DAILY_QUESTIONS.length;

		expect(dailyQuestionIndex("2026-03-01")).toBe(index);
		expect(dailyQuestion("2026-03-01")).toBe(DAILY_QUESTIONS[index]);
	});

	it("returns the same question for everyone on a given date", () => {
		expect(dailyQuestion("2026-10-05")).toBe(dailyQuestion("2026-10-05"));
		expect(dailyQuestion("2026-10-05")).not.toBe(dailyQuestion("2026-10-06"));
	});
});
