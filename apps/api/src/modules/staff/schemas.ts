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

export type StaffUserListQuery = z.infer<typeof StaffUserListQuerySchema>;
export type StaffUserUpdate = z.infer<typeof StaffUserUpdateSchema>;
