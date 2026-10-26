import { z } from "@hono/zod-openapi";
import { weightsSumToOne } from "@/lib/matching-config";
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

export const StaffRecommendationsResponseSchema = z
	.object({
		weights: z.object({ bio: z.number(), interest: z.number(), geo: z.number(), pref: z.number() }),
		recommendations: z.array(
			z.object({
				candidateId: z.number().int(),
				name: z.string(),
				isSynthetic: z.boolean(),
				rank: z.number().int().nullable(),
				storedScore: z.number().nullable(),
				shownAt: z.string(),
				actedOn: z.boolean(),
				bio: z.number().nullable(),
				interest: z.number(),
				geo: z.number(),
				prefUToV: z.number(),
				prefVToU: z.number(),
				pUToV: z.number(),
				qVToU: z.number(),
				reciprocal: z.number(),
				crossings: z.number().int(),
				score: z.number(),
			}),
		),
	})
	.openapi("StaffRecommendationsResponse");

export const MatchingConfigSchema = z
	.object({
		batchSize: z.number().int().min(1).max(50),
		cooldownHours: z
			.number()
			.min(0)
			.max(24 * 30),
		weights: z
			.object({
				bio: z.number().min(0).max(1),
				interest: z.number().min(0).max(1),
				geo: z.number().min(0).max(1),
				pref: z.number().min(0).max(1),
			})
			.refine(weightsSumToOne, { message: "Weights must sum to 1" }),
		crossPathsLambda: z.number().min(0).max(1),
	})
	.openapi("MatchingConfig");

export const MatchingConfigResponseSchema = z
	.object({
		config: MatchingConfigSchema,
		defaults: MatchingConfigSchema,
		updatedAt: z.string().nullable(),
		updatedBy: z.string().nullable(),
	})
	.openapi("MatchingConfigResponse");

export const StaffWalkerIdParamSchema = z.object({
	walkerId: z.coerce.number().int().positive(),
});

const radiusM = z.number().int().min(100).max(5000);
const stepM = z.number().int().min(10).max(1000);

export const AssignWalkersBodySchema = z
	.object({
		/** Specific synthetic profile ids; when omitted, `count` are picked at random from the target's pool. */
		walkerIds: z.array(z.number().int().positive()).max(20).optional(),
		count: z.number().int().min(1).max(20).optional(),
		/** Walk center; defaults to the target's current location. */
		centerLat: z.number().min(-90).max(90).optional(),
		centerLon: z.number().min(-180).max(180).optional(),
		radiusM: radiusM.default(800),
		stepM: stepM.default(150),
	})
	.openapi("AssignWalkersBody");

export const StepWalkersBodySchema = z
	.object({
		/** Stamp the target's location as fresh first, as if their app had just reported it. */
		markTargetPresent: z.boolean().optional(),
	})
	.openapi("StepWalkersBody");

export const UpdateWalkerBodySchema = z
	.object({ active: z.boolean().optional(), radiusM: radiusM.optional(), stepM: stepM.optional() })
	.openapi("UpdateWalkerBody");

const CrossingSchema = z.object({
	count: z.number().int(),
	lastCrossedAt: z.string().nullable(),
	lastPlace: z.string().nullable(),
});

export const WalkersOverviewSchema = z
	.object({
		rules: z.object({
			crossingRadiusM: z.number(),
			windowMinutes: z.number(),
			cooldownHours: z.number(),
			stepEveryMinutes: z.number(),
		}),
		target: z.object({
			profileId: z.number().int(),
			name: z.string(),
			isSynthetic: z.boolean(),
			lookingFor: z.number().int(),
			latitude: z.number().nullable(),
			longitude: z.number().nullable(),
			displayLocation: z.string().nullable(),
			locationUpdatedAt: z.string().nullable(),
			shareCrossPaths: z.boolean(),
			locationHidden: z.boolean(),
		}),
		/** Set when this profile is itself a walker. */
		walkingFor: z.object({ targetId: z.number().int(), name: z.string() }).nullable(),
		walkers: z.array(
			z.object({
				walkerId: z.number().int(),
				name: z.string(),
				latitude: z.number().nullable(),
				longitude: z.number().nullable(),
				locationUpdatedAt: z.string().nullable(),
				centerLat: z.number(),
				centerLon: z.number(),
				radiusM: z.number().int(),
				stepM: z.number().int(),
				active: z.boolean(),
				lastStepAt: z.string().nullable(),
				createdAt: z.string(),
				createdBy: z.string().nullable(),
				distanceToTargetM: z.number().nullable(),
				/** Why the next step can't record a crossing with the target; empty when it can. */
				blockers: z.array(z.string()),
				crossing: CrossingSchema.nullable(),
			}),
		),
		crossings: z.array(
			CrossingSchema.extend({
				otherId: z.number().int(),
				name: z.string(),
				isSynthetic: z.boolean(),
				isWalker: z.boolean(),
			}),
		),
		lastAction: z
			.object({
				assigned: z.number().int().optional(),
				stepped: z.number().int().optional(),
				crossingsRecorded: z.number().int(),
			})
			.nullable(),
	})
	.openapi("WalkersOverview");

export type AssignWalkersBody = z.infer<typeof AssignWalkersBodySchema>;
export type UpdateWalkerBody = z.infer<typeof UpdateWalkerBodySchema>;
export type StaffUserListQuery = z.infer<typeof StaffUserListQuerySchema>;
export type StaffUserUpdate = z.infer<typeof StaffUserUpdateSchema>;
export type InteractionGraphQuery = z.infer<typeof InteractionGraphQuerySchema>;
