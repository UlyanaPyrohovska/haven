import { z } from "@hono/zod-openapi";

const moodSlugValues = ["happy", "calm", "excited", "tired", "low", "stressed"] as const;

export const ErrorSchema = z
	.object({
		code: z.string(),
		message: z.string(),
	})
	.openapi("MoodError");

export const MoodSlugSchema = z.enum(moodSlugValues).openapi("MoodSlug");

export const MoodTodayResponseSchema = z
	.object({
		mood: MoodSlugSchema.nullable(),
	})
	.openapi("MoodTodayResponse");

export const PutMoodTodayBodySchema = z
	.object({
		mood: MoodSlugSchema,
	})
	.openapi("PutMoodTodayBody");

export type PutMoodTodayBody = z.infer<typeof PutMoodTodayBodySchema>;
