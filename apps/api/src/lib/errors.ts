import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ServiceError = {
	status: ContentfulStatusCode;
	code: string;
	message: string;
};

export const errors = {
	unauthorized: {
		status: 401,
		code: "UNAUTHORIZED",
		message: "Authentication required",
	},
	not_found: {
		status: 404,
		code: "NOT_FOUND",
		message: "Resource not found",
	},
	no_profile: {
		status: 400,
		code: "NO_PROFILE",
		message: "Complete onboarding before browsing connections",
	},
	internal_error: {
		status: 500,
		code: "INTERNAL_ERROR",
		message: "Something went wrong",
	},
} as const satisfies Record<string, ServiceError>;

export function isServiceError(error: unknown): error is ServiceError {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		"code" in error &&
		"message" in error &&
		typeof (error as ServiceError).status === "number" &&
		typeof (error as ServiceError).code === "string" &&
		typeof (error as ServiceError).message === "string"
	);
}
