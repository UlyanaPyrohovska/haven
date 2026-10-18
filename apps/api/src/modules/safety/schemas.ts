import { z } from "@hono/zod-openapi";

export const ReportReasons = ["inappropriate_photo", "harassment", "spam_or_fake", "underage", "other"] as const;

export const ErrorSchema = z
	.object({
		code: z.string(),
		message: z.string(),
	})
	.openapi("Error");

export const ReportBodySchema = z
	.object({
		reason: z.enum(ReportReasons),
		details: z.string().trim().max(500).nullable().optional(),
	})
	.openapi("ReportBody");

export type ReportBody = z.infer<typeof ReportBodySchema>;

export const SafetyResponseSchema = z.object({ blocked: z.literal(true) }).openapi("SafetyResponse");
