import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemedText } from "@/components/themed-text";
import { FontSize, Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import type { MatchSummary } from "@/lib/api/recommendations";
import { formatMessageTime } from "@/lib/chat/format";

export function ConversationRow({ match, onPress }: { match: MatchSummary; onPress: () => void }) {
	const { t } = useTranslation();
	const theme = useTheme();
	const unread = match.unreadCount > 0;
	const preview = match.lastMessage
		? match.lastMessage.senderId === match.candidateId
			? match.lastMessage.body
			: t("chat.youPrefix", { message: match.lastMessage.body })
		: t("chat.sayHi");

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={t("chat.openConversation", { name: match.displayName })}
			onPress={onPress}
			style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
		>
			<UserAvatar imageUrl={match.photoUrl} name={match.displayName} size={52} />
			<View style={styles.copy}>
				<View style={styles.topLine}>
					<ThemedText type="label" numberOfLines={1} style={styles.name}>
						{match.displayName}
					</ThemedText>
					{match.locationLabel ? (
						<ThemedText type="caption" numberOfLines={1} style={[styles.location, { color: theme.muted }]}>
							{match.locationLabel}
						</ThemedText>
					) : null}
					<ThemedText type="caption" style={[styles.time, { color: unread ? theme.tint : theme.muted }]}>
						{formatMessageTime(match.lastActivityAt)}
					</ThemedText>
				</View>
				<View style={styles.topLine}>
					<ThemedText
						type={unread ? "bodySemiBold" : "caption"}
						numberOfLines={1}
						style={[styles.preview, { color: unread ? theme.text : theme.muted }]}
					>
						{preview}
					</ThemedText>
					{unread ? (
						<View style={[styles.badge, { backgroundColor: theme.tint }]}>
							<ThemedText type="caption" style={{ color: theme.onTint, fontSize: FontSize.xs }}>
								{match.unreadCount}
							</ThemedText>
						</View>
					) : null}
				</View>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
	copy: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	topLine: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	name: {
		flexShrink: 1,
	},
	location: {
		flexShrink: 1,
	},
	time: {
		marginLeft: "auto",
	},
	preview: {
		flex: 1,
	},
	badge: {
		minWidth: 20,
		height: 20,
		borderRadius: Radius.pill,
		paddingHorizontal: 6,
		alignItems: "center",
		justifyContent: "center",
	},
});
