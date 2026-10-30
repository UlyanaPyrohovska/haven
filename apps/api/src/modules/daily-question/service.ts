import type { Context } from "hono";
import { getDb } from "@/db";
import { dailyQuestion } from "@/lib/daily/daily-questions";
import { utcToday } from "@/lib/daily/mood";
import { errors } from "@/lib/http/service-errors";
import * as profileRepository from "@/modules/profile/repository";
import { requireUserId } from "@/modules/profile/service";
import * as repository from "./repository";
import type { PutDailyQuestionTodayBody } from "./schemas";

async function requireProfileId(c: Context<{ Bindings: CloudflareBindings }>) {
	const userId = await requireUserId(c);
	const db = getDb(c.env.DATABASE_URL);
	const profileId = await profileRepository.findProfileIdByUserId(db, userId);

	if (!profileId) {
		throw errors.no_profile;
	}

	return { db, profileId };
}

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
