import { z } from "@hono/zod-openapi";
import { DAILY_ANSWER_MAX_LENGTH } from "@/lib/daily-questions";

export const ErrorSchema = z
	.object({
		code: z.string(),
		message: z.string(),
	})
	.openapi("DailyQuestionError");

export const DailyQuestionTodayResponseSchema = z
	.object({
		question: z.string(),
		answer: z.string().nullable(),
	})
	.openapi("DailyQuestionTodayResponse");

export const PutDailyQuestionTodayBodySchema = z
	.object({
		answer: z.string().trim().min(1).max(DAILY_ANSWER_MAX_LENGTH),
	})
	.openapi("PutDailyQuestionTodayBody");

export type PutDailyQuestionTodayBody = z.infer<typeof PutDailyQuestionTodayBodySchema>;
