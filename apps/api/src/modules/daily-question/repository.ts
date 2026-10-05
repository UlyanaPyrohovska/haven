import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { dailyQuestionAnswers } from "@/db/schema";

export async function findAnswerForDate(db: Db, profileId: number, answerDate: string) {
	const [row] = await db
		.select({ answer: dailyQuestionAnswers.answer })
		.from(dailyQuestionAnswers)
		.where(and(eq(dailyQuestionAnswers.userProfileId, profileId), eq(dailyQuestionAnswers.answerDate, answerDate)))
		.limit(1);

	return row ?? null;
}

export async function upsertAnswerForDate(db: Db, profileId: number, answerDate: string, answer: string) {
	const existing = await findAnswerForDate(db, profileId, answerDate);

	if (existing) {
		await db
			.update(dailyQuestionAnswers)
			.set({ answer, updatedAt: new Date() })
			.where(and(eq(dailyQuestionAnswers.userProfileId, profileId), eq(dailyQuestionAnswers.answerDate, answerDate)));

		return;
	}

	await db.insert(dailyQuestionAnswers).values({
		userProfileId: profileId,
		answer,
		answerDate,
	});
}
