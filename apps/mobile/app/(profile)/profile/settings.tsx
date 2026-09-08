import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";

import { ThemedText } from "@/components/themed-text";
import { ChipGroup } from "@/components/ui/chip-group";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { signOut } from "@/lib/auth-client";
import {
	ThemePreference,
	type ThemePreferenceValue,
	useThemePreference,
} from "@/lib/theme-preference";

const copy = Strings.profile.settingsScreen;

export default function ProfileSettingsScreen() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { preference, setPreference } = useThemePreference();

	const appearanceOptions = useMemo(
		() => [
			{ value: ThemePreference.system, label: copy.appearance.system },
			{ value: ThemePreference.light, label: copy.appearance.light },
			{ value: ThemePreference.dark, label: copy.appearance.dark },
		],
		[],
	);

	const onSignOut = async () => {
		await signOut();
		queryClient.clear();
		router.replace("/login");
	};

	return (
		<FormScreen title={copy.title} subtitle={copy.subtitle} showBack>
			<MenuCard>
				<View style={styles.appearance}>
					<View style={styles.appearanceCopy}>
						<ThemedText type="label">{copy.appearance.title}</ThemedText>
						<ThemedText type="caption">{copy.appearance.subtitle}</ThemedText>
					</View>
					<ChipGroup<ThemePreferenceValue>
						hideLabel
						label={copy.appearance.title}
						options={appearanceOptions}
						value={preference}
						onChange={setPreference}
					/>
				</View>
			</MenuCard>

			<MenuCard>
				<MenuRow
					label={copy.privacy.title}
					subtitle={`${copy.privacy.subtitle} · ${copy.comingSoon}`}
				/>
				<MenuDivider />
				<MenuRow
					label={copy.visibility.title}
					subtitle={`${copy.visibility.subtitle} · ${copy.comingSoon}`}
				/>
				<MenuDivider />
				<MenuRow
					label={copy.location.title}
					subtitle={`${copy.location.subtitle} · ${copy.comingSoon}`}
				/>
			</MenuCard>

			<MenuCard>
				<MenuRow label={Strings.common.signOut} onPress={onSignOut} destructive />
			</MenuCard>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	appearance: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.lg,
		gap: Spacing.md,
	},
	appearanceCopy: {
		gap: Spacing.xs,
	},
});
