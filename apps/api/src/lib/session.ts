import type { Context } from "hono";
import { createAuth } from "@/lib/auth";

/** Resolves the Better Auth session from request headers, or null when unauthenticated. */
export async function getSessionUserId(c: Context<{ Bindings: CloudflareBindings }>): Promise<string | null> {
	const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });

	return session?.user.id ?? null;
}

export const UNAUTHORIZED = { code: "UNAUTHORIZED", message: "Authentication required" } as const;
