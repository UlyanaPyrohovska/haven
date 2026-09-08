import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

type ProfilePhotoViewerProps = {
	visible: boolean;
	imageUrl: string;
	onClose: () => void;
	onChangePhoto: () => void;
	onRemovePhoto: () => void;
	busy?: boolean;
};

export function ProfilePhotoViewer({
	visible,
	imageUrl,
	onClose,
	onChangePhoto,
	onRemovePhoto,
	busy = false,
}: ProfilePhotoViewerProps) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const { t } = useTranslation();

	return (
		<Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
			<View style={[styles.root, { backgroundColor: theme.scrim }]}>
				<Pressable accessibilityLabel={t("profile.photo.close")} style={styles.backdrop} onPress={onClose} />

				<View style={styles.content}>
					<Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" accessibilityRole="image" />

					<View style={[styles.toolbar, { paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.lg }]}>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("profile.photo.close")}
							disabled={busy}
							onPress={onClose}
							style={({ pressed }) => [
								styles.iconButton,
								{ backgroundColor: theme.field, opacity: pressed || busy ? 0.7 : 1 },
							]}
						>
							<Ionicons name="close" size={22} color={theme.text} />
						</Pressable>
					</View>

					<View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.xl }]}>
						<Button label={t("profile.photo.change")} onPress={onChangePhoto} loading={busy} disabled={busy} />
						<Button
							label={t("profile.photo.remove")}
							variant="ghost"
							onPress={onRemovePhoto}
							disabled={busy}
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	backdrop: {
		...StyleSheet.absoluteFill,
	},
	content: {
		flex: 1,
		justifyContent: "center",
	},
	image: {
		width: "100%",
		height: "72%",
	},
	toolbar: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		flexDirection: "row",
		justifyContent: "flex-start",
	},
	iconButton: {
		width: 40,
		height: 40,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	footer: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		gap: Spacing.sm,
	},
});
