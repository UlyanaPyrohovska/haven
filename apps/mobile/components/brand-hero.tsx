import { StyleSheet, View } from "react-native";

import { HavenLogo } from "@/components/haven-logo";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { useTheme } from "@/hooks/use-theme";

export type BrandHeroProps = {
	tagline: string;
	logoHeight?: number;
};

/** Logo, wordmark and tagline stack that opens the auth screens. */
export function BrandHero({ tagline, logoHeight = 84 }: BrandHeroProps) {
	const theme = useTheme();

	return (
		<View style={styles.root}>
			<HavenLogo height={logoHeight} />

			<ThemedText type="wordmark" style={styles.wordmark}>
				{Strings.app.name}
			</ThemedText>

			<ThemedText style={[styles.tagline, { color: theme.muted }]}>{tagline}</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		alignItems: "center",
	},
	wordmark: {
		marginTop: Spacing.lg,
		// Kodchasan sits with generous side bearings; matches the splash wordmark spacing.
		letterSpacing: 2,
	},
	tagline: {
		marginTop: Spacing.xs,
		textAlign: "center",
	},
});
