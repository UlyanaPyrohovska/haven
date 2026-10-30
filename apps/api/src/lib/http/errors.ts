import type { Context } from "hono";
import { fail } from "@/lib/http/fail";
import { errors, isServiceError, type ServiceError } from "@/lib/http/service-errors";

export const notFoundHandler = (c: Context) => fail(c, errors.not_found);

export const errorHandler = (err: unknown, c: Context) => {
	if (isServiceError(err)) {
		return fail(c, err);
	}

	const message = err instanceof Error ? err.message : String(err);
	console.error("[api] unhandled error:", message, err instanceof Error ? err.stack : err);

	return fail(c, errors.internal_error);
};

export type { ServiceError };
