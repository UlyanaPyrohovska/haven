import { z } from "@hono/zod-openapi";

export const ErrorSchema = z.object({ code: z.string(), message: z.string() }).openapi("NotificationsError");

export const PutPushTokenBodySchema = z
	.object({
		token: z.string().min(1).max(4096),
		platform: z.enum(["ios", "android"]),
	})
	.openapi("PutPushTokenBody");

export const DeletePushTokenBodySchema = z
	.object({ token: z.string().min(1).max(4096) })
	.openapi("DeletePushTokenBody");

export type PutPushTokenBody = z.infer<typeof PutPushTokenBodySchema>;

export const OkSchema = z.object({ ok: z.literal(true) }).openapi("PushTokenOk");
