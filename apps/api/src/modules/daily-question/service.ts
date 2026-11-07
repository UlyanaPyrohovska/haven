import type { Context } from "hono";
import { dailyQuestion } from "@/lib/daily/daily-questions";
import { utcToday } from "@/lib/daily/mood";
import { requireProfileId } from "@/modules/profile/service";
import * as repository from "./repository";
import type { PutDailyQuestionTodayBody } from "./schemas";

export async function getTodayDailyQuestion(c: Context<{ Bindings: CloudflareBindings }>) {
	const { db, profileId } = await requireProfileId(c);
	const today = utcToday();
	const row = await repository.findAnswerForDate(db, profileId, today);

	return {
		question: dailyQuestion(today),
		answer: row?.answer?.trim() || null,
	};
}

export async function putTodayDailyQuestion(
	c: Context<{ Bindings: CloudflareBindings }>,
	body: PutDailyQuestionTodayBody,
) {
	const { db, profileId } = await requireProfileId(c);
	const today = utcToday();

	await repository.upsertAnswerForDate(db, profileId, today, body.answer);

	return {
		question: dailyQuestion(today),
		answer: body.answer,
	};
}
