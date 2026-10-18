import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import type { ChatMessage } from "@/lib/api/chat";
import { formatMessageTime } from "@/lib/chat/format";

export function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
	const theme = useTheme();
	const pending = message.id < 0;

	return (
		<View style={[styles.row, mine ? styles.mine : styles.theirs]}>
			<View
				style={[
					styles.bubble,
					mine
						? { backgroundColor: theme.tint, borderBottomRightRadius: Radius.sm }
						: { backgroundColor: theme.surface, borderColor: theme.border, borderBottomLeftRadius: Radius.sm },
					!mine && styles.bordered,
					{ opacity: pending ? 0.6 : 1 },
				]}
			>
				<ThemedText style={{ color: mine ? theme.onTint : theme.text, lineHeight: 22 }}>{message.body}</ThemedText>
			</View>
			<ThemedText type="caption" style={{ color: theme.muted }}>
				{formatMessageTime(message.createdAt)}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		maxWidth: "80%",
		gap: 2,
		marginVertical: Spacing.xs,
	},
	mine: {
		alignSelf: "flex-end",
		alignItems: "flex-end",
	},
	theirs: {
		alignSelf: "flex-start",
		alignItems: "flex-start",
	},
	bubble: {
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
	},
	bordered: {
		borderWidth: StyleSheet.hairlineWidth,
	},
});
