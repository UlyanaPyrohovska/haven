import { z } from "@hono/zod-openapi";
import { ProfileUpdateSchema } from "@/modules/profile/schemas";

export const StaffUserListQuerySchema = z
	.object({
		q: z.string().trim().max(200).optional(),
		limit: z.coerce.number().int().min(1).max(100).default(25),
		offset: z.coerce.number().int().min(0).default(0),
	})
	.openapi("StaffUserListQuery");

export const StaffUserSummarySchema = z
	.object({
		profileId: z.number().int(),
		userId: z.string().nullable(),
		displayName: z.string().nullable(),
		email: z.string().nullable(),
		isSynthetic: z.boolean(),
		lookingFor: z.number().int(),
		createdAt: z.string(),
	})
	.openapi("StaffUserSummary");

export const StaffUserListResponseSchema = z
	.object({
		users: z.array(StaffUserSummarySchema),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
	})
	.openapi("StaffUserListResponse");

export const StaffAuthUserSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
		role: z.string().nullable(),
		banned: z.boolean().nullable(),
		banReason: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.nullable()
	.openapi("StaffAuthUser");

export const StaffUserDetailResponseSchema = z
	.object({
		profile: z.record(z.string(), z.unknown()),
		auth: StaffAuthUserSchema,
	})
	.openapi("StaffUserDetailResponse");

export const StaffUserUpdateSchema = ProfileUpdateSchema.extend({
	authName: z.string().trim().min(1).max(200).optional(),
	authEmail: z.string().trim().email().optional(),
}).openapi("StaffUserUpdate");

export const StaffUserIdParamSchema = z.object({
	profileId: z.coerce.number().int().positive(),
});

export const ErrorSchema = z
	.object({
		code: z.string(),
		message: z.string(),
	})
	.openapi("StaffError");

export const SimulationTickBodySchema = z
	.object({
		limit: z.number().int().min(1).max(200).optional(),
	})
	.openapi("SimulationTickBody");

export const SimulationTickResponseSchema = z
	.object({
		tickId: z.string(),
		inboundAnswered: z.number().int(),
		agentsActed: z.number().int(),
		decisions: z.number().int(),
		accepts: z.number().int(),
		newMatches: z.number().int(),
		realBatches: z.number().int(),
	})
	.openapi("SimulationTickResponse");

export const InteractionGraphQuerySchema = z
	.object({
		lookingFor: z.coerce.number().int().min(0).max(1).default(1),
		edges: z.enum(["match", "like", "all"]).default("match"),
		since: z.string().datetime().optional(),
		limit: z.coerce.number().int().min(1).max(5000).default(2000),
	})
	.openapi("InteractionGraphQuery");

export const InteractionGraphResponseSchema = z
	.object({
		nodes: z.array(
			z.object({
				id: z.number().int(),
				name: z.string(),
				isSynthetic: z.boolean(),
				lookingFor: z.number().int(),
				degree: z.number().int(),
			}),
		),
		edges: z.array(
			z.object({
				source: z.number().int(),
				target: z.number().int(),
				decA: z.number().int().nullable(),
				decB: z.number().int().nullable(),
				match: z.boolean(),
			}),
		),
	})
	.openapi("InteractionGraphResponse");

const DailyCountSchema = z.object({ day: z.string(), count: z.number().int() });

export const StaffStatsResponseSchema = z
	.object({
		days: z.number().int(),
		profiles: z.object({
			total: z.number().int(),
			synthetic: z.number().int(),
			dating: z.number().int(),
		}),
		activity: z.object({
			matches: z.number().int(),
			messages: z.number().int(),
			reports: z.number().int(),
			dailyAnswersToday: z.number().int(),
			moodCheckinsToday: z.number().int(),
		}),
		signupsByDay: z.array(DailyCountSchema),
		matchesByDay: z.array(DailyCountSchema),
		moods: z.array(z.object({ mood: z.string(), count: z.number().int() })),
	})
	.openapi("StaffStatsResponse");

export type StaffUserListQuery = z.infer<typeof StaffUserListQuerySchema>;
export type StaffUserUpdate = z.infer<typeof StaffUserUpdateSchema>;
export type InteractionGraphQuery = z.infer<typeof InteractionGraphQuerySchema>;
