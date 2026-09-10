import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type MenuRowProps = {
	label: string;
	subtitle?: string;
	photoUrl?: string;
	onPress?: () => void;
	destructive?: boolean;
	disabled?: boolean;
};

export function MenuRow({ label, subtitle, photoUrl, onPress, destructive = false, disabled = false }: MenuRowProps) {
	const theme = useTheme();

	const content = (
		<>
			{photoUrl ? <UserAvatar imageUrl={photoUrl} name={label} size={44} /> : null}
			<View style={styles.copy}>
				<ThemedText
					type="label"
					style={destructive ? { color: theme.danger } : disabled ? { color: theme.muted } : undefined}
				>
					{label}
				</ThemedText>
				{subtitle ? (
					<ThemedText type="caption" style={{ color: theme.muted }}>
						{subtitle}
					</ThemedText>
				) : null}
			</View>
			{onPress ? <Ionicons name="chevron-forward" size={18} color={theme.icon} /> : null}
		</>
	);

	if (!onPress) {
		return <View style={styles.row}>{content}</View>;
	}

	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [styles.row, { opacity: pressed && !disabled ? 0.7 : disabled ? 0.6 : 1 }]}
		>
			{content}
		</Pressable>
	);
}

export function MenuCard({ children }: { children: ReactNode }) {
	const theme = useTheme();

	return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function MenuDivider() {
	const theme = useTheme();

	return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
	card: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.lg,
		gap: Spacing.md,
	},
	copy: {
		flex: 1,
		gap: Spacing.xs,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginHorizontal: Spacing.lg,
	},
});
