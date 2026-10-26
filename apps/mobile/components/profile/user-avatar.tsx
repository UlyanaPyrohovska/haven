import { Image, type ImageStyle } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { profileInitials } from "@/lib/profile/display";

type UserAvatarProps = {
	imageUrl?: string | null;
	name?: string;
	size?: number;
	style?: ImageStyle;
};

export function UserAvatar({ imageUrl, name, size = 88, style }: UserAvatarProps) {
	const theme = useTheme();
	const initials = profileInitials(name);
	const dimension = { width: size, height: size, borderRadius: size / 2 };
	// Keyed by URL so a new photo gets a fresh attempt.
	const [failedUrl, setFailedUrl] = useState<string | null>(null);

	if (imageUrl && imageUrl !== failedUrl) {
		return (
			<Image
				source={{ uri: imageUrl }}
				style={[styles.avatar, dimension, { borderColor: theme.tint }, style]}
				contentFit="cover"
				onError={() => setFailedUrl(imageUrl)}
				accessibilityRole="image"
				accessibilityLabel={name ? `${name}'s profile photo` : "Profile photo"}
			/>
		);
	}

	return (
		<View style={[styles.avatar, dimension, { backgroundColor: theme.accentSoft, borderColor: theme.tint }, style]}>
			<ThemedText type="title" style={{ color: theme.tint, fontSize: Math.round(size * 0.32) }}>
				{initials}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	avatar: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
});
