import { createAuth } from "@/lib/auth/auth";
import { createOpenAPIApp } from "@/lib/openapi";

export const auth = createOpenAPIApp();

auth.on(["GET", "POST"], "*", (c) => createAuth(c.env).handler(c.req.raw));

export default auth;
