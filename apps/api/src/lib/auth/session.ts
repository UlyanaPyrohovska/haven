import type { Context } from "hono";
import { createAuth } from "@/lib/auth/auth";
import { errors } from "@/lib/http/service-errors";

type StaffSessionUser = {
	id: string;
	role?: string | null;
};

/** Resolves the Better Auth session from request headers, or null when unauthenticated. */
export async function getSessionUserId(c: Context<{ Bindings: CloudflareBindings }>): Promise<string | null> {
	const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });

	return session?.user.id ?? null;
}

/** Requires a signed-in Better Auth user with the `admin` role (staff backoffice). */
export async function requireStaffAdmin(c: Context<{ Bindings: CloudflareBindings }>) {
	const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });

	if (!session?.user) {
		throw errors.unauthorized;
	}

	const role = (session.user as StaffSessionUser).role;
	if (role !== "admin") {
		throw errors.forbidden;
	}

	return session;
}

export const UNAUTHORIZED = { code: "UNAUTHORIZED", message: "Authentication required" } as const;
