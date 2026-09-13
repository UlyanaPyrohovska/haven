import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { StepProgress } from "@/components/ui/step-progress";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
export type FormScreenHeaderButtonProps = {
	accessibilityLabel: string;
	onPress: () => void;
	children: ReactNode;
};

export function FormScreenHeaderButton({ accessibilityLabel, onPress, children }: FormScreenHeaderButtonProps) {
	const theme = useTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			hitSlop={Spacing.md}
			onPress={onPress}
			style={({ pressed }) => [styles.headerButton, { backgroundColor: theme.field, opacity: pressed ? 0.6 : 1 }]}
		>
			{children}
		</Pressable>
	);
}

export type FormScreenProps = {
	title: string;
	subtitle?: string;
	/** Branding stack rendered above the title, e.g. `BrandHero` on the auth screens. */
	hero?: ReactNode;
	/** Vertically centres the content and centre-aligns its text. Used by login and register. */
	centered?: boolean;
	/** Renders a back chevron; defaults to a native stack pop when no handler is given. */
	showBack?: boolean;
	onBack?: () => void;
	/** Optional action rendered opposite the back button, e.g. a preview icon. */
	headerRight?: ReactNode;
	/** Shows a progress bar and "Step x of y" caption above the title. */
	progress?: { current: number; total: number };
	/** Pinned below the scroll area so the primary action stays reachable. */
	footer?: ReactNode;
	children: ReactNode;
};

/** Shared scaffold for auth and onboarding screens: safe area, keyboard avoidance, sticky footer. */
export function FormScreen({
	title,
	subtitle,
	hero,
	centered = false,
	showBack,
	onBack,
	headerRight,
	progress,
	footer,
	children,
}: FormScreenProps) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const navigation = useNavigation();
	const { t } = useTranslation();

	return (
		<KeyboardAvoidingView
			style={[styles.root, { backgroundColor: theme.background }]}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[
					styles.content,
					centered && styles.contentCentered,
					{ paddingTop: insets.top + Spacing.md },
				]}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
			>
				{showBack || headerRight ? (
					<View style={styles.headerRow}>
						<View style={styles.headerSideStart}>
							{showBack ? (
								<FormScreenHeaderButton accessibilityLabel={t("common.back")} onPress={onBack ?? (() => navigation.goBack())}>
									<Ionicons name="chevron-back" size={20} color={theme.text} />
								</FormScreenHeaderButton>
							) : null}
						</View>
						<View style={styles.headerSideEnd}>{headerRight}</View>
					</View>
				) : null}

				{progress ? <StepProgress current={progress.current} total={progress.total} /> : null}

				{hero ? <View style={styles.hero}>{hero}</View> : null}

				<ThemedText type={centered ? "subtitle" : "title"} style={centered ? styles.centeredText : styles.title}>
					{title}
				</ThemedText>
				{subtitle ? (
					<ThemedText style={[styles.subtitle, centered && styles.centeredText, { color: theme.muted }]}>
						{subtitle}
					</ThemedText>
				) : null}

				<View style={styles.body}>{children}</View>
			</ScrollView>

			{footer ? (
				<View
					style={[
						styles.footer,
						{
							backgroundColor: theme.background,
							borderTopColor: theme.border,
							paddingBottom: insets.bottom + Spacing.lg,
						},
					]}
				>
					{footer}
				</View>
			) : null}
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
	content: {
		paddingHorizontal: Spacing.xl,
		paddingBottom: Spacing.xxl,
		gap: Spacing.sm,
	},
	contentCentered: {
		// Centres short forms, while still scrolling once the keyboard shrinks the viewport.
		flexGrow: 1,
		justifyContent: "center",
	},
	headerButton: {
		width: 40,
		height: 40,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.md,
	},
	headerSideStart: {
		width: 40,
		height: 40,
		justifyContent: "center",
	},
	headerSideEnd: {
		minHeight: 40,
		justifyContent: "center",
		alignItems: "flex-end",
	},
	title: {
		lineHeight: 38,
	},
	centeredText: {
		textAlign: "center",
	},
	hero: {
		marginBottom: Spacing.xl,
	},
	subtitle: {
		marginTop: Spacing.xs,
	},
	body: {
		marginTop: Spacing.xl,
		gap: Spacing.lg,
	},
	footer: {
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.lg,
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: Spacing.md,
	},
});
