import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type DialogProps = {
	visible: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	onConfirm: () => void;
	/** Adds a secondary action; omit for a single-action notice. */
	cancelLabel?: string;
	onCancel?: () => void;
	icon?: keyof typeof Ionicons.glyphMap;
	tone?: "default" | "danger";
	/**
	 * Whether tapping the backdrop or pressing Android back closes the dialog. Turn this off
	 * for decisions the user has to acknowledge deliberately.
	 */
	dismissable?: boolean;
	/** Extra content between the message and the actions, e.g. a choice the confirm acts on. */
	children?: ReactNode;
	/** Shows a spinner on the confirm action while it runs. */
	loading?: boolean;
};

/**
 * In-app replacement for `Alert.alert`, so confirmations use Haven's own typography and
 * colours instead of the platform dialog.
 */
export function Dialog({
	visible,
	title,
	message,
	confirmLabel,
	onConfirm,
	cancelLabel,
	onCancel,
	icon,
	tone = "default",
	dismissable = true,
	children,
	loading = false,
}: DialogProps) {
	const theme = useTheme();
	const accent = tone === "danger" ? theme.danger : theme.text;
	const dismiss = onCancel ?? onConfirm;

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			statusBarTranslucent
			onRequestClose={dismissable ? dismiss : undefined}
		>
			<View style={styles.root}>
				{dismissable ? (
					<Pressable
						accessibilityLabel={cancelLabel ?? confirmLabel}
						style={[styles.backdrop, { backgroundColor: theme.scrim }]}
						onPress={dismiss}
					/>
				) : (
					<View style={[styles.backdrop, { backgroundColor: theme.scrim }]} />
				)}

				<View
					accessibilityRole="alert"
					accessibilityViewIsModal
					style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}
				>
					{icon ? (
						<View style={[styles.icon, { backgroundColor: theme.field }]}>
							<Ionicons name={icon} size={26} color={accent} />
						</View>
					) : null}

					<ThemedText type="subtitle" style={styles.centered}>
						{title}
					</ThemedText>

					<ThemedText style={[styles.centered, { color: theme.muted }]}>{message}</ThemedText>

					{children}

					<View style={styles.actions}>
						<Button label={confirmLabel} onPress={onConfirm} loading={loading} />
						{cancelLabel && onCancel ? <Button label={cancelLabel} variant="ghost" onPress={onCancel} /> : null}
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	backdrop: {
		...StyleSheet.absoluteFill,
	},
	card: {
		width: "100%",
		maxWidth: 400,
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.xl,
		alignItems: "center",
		gap: Spacing.md,
		// Lifts the card off the scrim on both platforms.
		elevation: 8,
		shadowColor: "#000000",
		shadowOpacity: 0.18,
		shadowRadius: 24,
		shadowOffset: { width: 0, height: 8 },
	},
	icon: {
		width: 56,
		height: 56,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.xs,
	},
	centered: {
		textAlign: "center",
	},
	actions: {
		alignSelf: "stretch",
		marginTop: Spacing.md,
		gap: Spacing.sm,
	},
});
