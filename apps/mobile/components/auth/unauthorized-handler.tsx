import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { resetToLogin } from "@/lib/auth/navigation";
import { setUnauthorizedHandler } from "@/lib/auth/unauthorized";

/** Wires API 401 handling to React Query + Expo Router. */
export function UnauthorizedHandler() {
	const router = useRouter();
	const queryClient = useQueryClient();

	useEffect(() => {
		setUnauthorizedHandler(() => {
			queryClient.clear();
			resetToLogin(router);
		});

		return () => {
			setUnauthorizedHandler(null);
		};
	}, [queryClient, router]);

	return null;
}
