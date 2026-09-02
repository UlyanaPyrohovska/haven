import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { useProfileQuery } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/lib/auth-client";

/**
 * Entry gate: sends signed-out users to login, users mid-signup to onboarding,
 * and everyone else into the app shell.
 */
export default function IndexRoute() {
	const { data: session, isPending: sessionPending, isRefetching: sessionRefetching } = useSession();
	const hasSession = Boolean(session);
	const profile = useProfileQuery(hasSession);

	if (sessionPending || sessionRefetching) {
		return <Loading />;
	}

	if (!hasSession) {
		return <Redirect href="/login" />;
	}

	if (profile.isPending) {
		return <Loading />;
	}

	if (profile.isError) {
		return (
			<ThemedView style={styles.centered}>
				<View style={styles.retry}>
					<ErrorBanner message={Strings.auth.errors.network} />
					<Button label={Strings.common.retry} onPress={() => profile.refetch()} />
				</View>
			</ThemedView>
		);
	}

	return <Redirect href={profile.data ? "/home" : "/basics"} />;
}

function Loading() {
	const theme = useTheme();

	return (
		<ThemedView style={styles.centered}>
			<ActivityIndicator color={theme.tint} />
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	retry: {
		alignSelf: "stretch",
		gap: Spacing.lg,
	},
});
