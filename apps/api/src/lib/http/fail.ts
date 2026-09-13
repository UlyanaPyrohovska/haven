import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ServiceError } from "@/lib/errors";

export function fail(c: Context, error: ServiceError) {
	const status = error.status as ContentfulStatusCode;
	return c.json({ code: error.code, message: error.message }, status);
}
