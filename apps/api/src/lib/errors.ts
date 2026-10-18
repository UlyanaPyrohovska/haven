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
	forbidden: {
		status: 403,
		code: "FORBIDDEN",
		message: "You do not have permission to perform this action",
	},
	no_profile: {
		status: 400,
		code: "NO_PROFILE",
		message: "Complete onboarding before browsing connections",
	},
	invalid_message: {
		status: 400,
		code: "INVALID_MESSAGE",
		message: "Message must be between 1 and 1000 characters",
	},
	not_matched: {
		status: 403,
		code: "NOT_MATCHED",
		message: "You can only message your matches",
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
