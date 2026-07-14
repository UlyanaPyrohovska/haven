import type { Context } from "hono";

export function validationErrorHook(result: { success: boolean; target: string }, c: Context) {
	if (result.success) return;

	let error = { code: "INVALID_REQUEST", message: "Request validation failed" };

	switch (result.target) {
		case "json":
			error = { code: "INVALID_JSON", message: "Request body is invalid" };
			break;
		case "form":
			error = { code: "INVALID_FORM", message: "Request body is invalid" };
			break;
		case "query":
			error = { code: "INVALID_QUERY", message: "Query parameters are invalid" };
			break;
		case "param":
			error = { code: "INVALID_PARAMS", message: "Route parameters are invalid" };
			break;
		case "header":
			error = { code: "INVALID_HEADERS", message: "Request headers are invalid" };
			break;
		case "cookie":
			error = { code: "INVALID_COOKIES", message: "Request cookies are invalid" };
			break;
	}

	return c.json({ message: error.message, code: error.code }, 400);
}
