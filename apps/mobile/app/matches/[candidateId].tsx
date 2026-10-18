import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Composer } from "@/components/chat/composer";
import { MessageBubble } from "@/components/chat/message-bubble";
import { SafetyDialogs, type SafetyKind } from "@/components/connections/safety-dialogs";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemedText } from "@/components/themed-text";
import { BackHomeButton } from "@/components/ui/back-home-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import {
	type ChatMessage,
	fetchMessages,
	type MessagesData,
	markMessagesRead,
	messagesQueryKey,
	sendMessage,
	upsertMessage,
} from "@/lib/api/chat";
import { matchesQueryKey } from "@/lib/api/recommendations";
import { useChatSocket } from "@/lib/chat/use-chat-socket";

/** Chat thread with one match. Messages persist via REST; the socket delivers live updates. */
export default function ChatThreadScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();
	const params = useLocalSearchParams<{ candidateId: string }>();
	const candidateId = Number(params.candidateId);
	const queryKey = messagesQueryKey(candidateId);
	const [draft, setDraft] = useState("");
	const [safetyDialog, setSafetyDialog] = useState<SafetyKind | null>(null);

	const thread = useInfiniteQuery({
		queryKey,
		queryFn: ({ pageParam }) => fetchMessages(candidateId, pageParam),
		initialPageParam: undefined as number | undefined,
		getNextPageParam: (last) => (last.hasMore ? last.messages.at(-1)?.id : undefined),
		enabled: Number.isFinite(candidateId),
	});

	const markRead = useCallback(async () => {
		await markMessagesRead(candidateId);
		await queryClient.invalidateQueries({ queryKey: matchesQueryKey });
	}, [candidateId, queryClient]);

	useFocusEffect(
		useCallback(() => {
			void markRead();
		}, [markRead]),
	);

	const { peerTyping, sendTyping } = useChatSocket(candidateId, (message) => {
		if (message.senderId === candidateId) {
			void markRead();
		}
	});

	const send = useMutation({
		mutationFn: (body: string) => sendMessage(candidateId, body),
		onMutate: (body) => {
			const pending: ChatMessage = { id: -Date.now(), senderId: 0, body, createdAt: new Date().toISOString() };
			queryClient.setQueryData<MessagesData>(queryKey, (data) => upsertMessage(data, pending));
			setDraft("");
			return { pendingId: pending.id };
		},
		onSuccess: ({ message }, _body, context) => {
			queryClient.setQueryData<MessagesData>(queryKey, (data) => upsertMessage(data, message, context?.pendingId));
			void queryClient.invalidateQueries({ queryKey: matchesQueryKey });
		},
		onError: (_error, body, context) => {
			queryClient.setQueryData<MessagesData>(queryKey, (data) =>
				data
					? {
							...data,
							pages: data.pages.map((page) => ({
								...page,
								messages: page.messages.filter((m) => m.id !== context?.pendingId),
							})),
						}
					: data,
			);
			setDraft(body);
		},
	});

	const peer = thread.data?.pages[0]?.peer;
	const messages = thread.data?.pages.flatMap((page) => page.messages) ?? [];

	return (
		<KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: theme.background }]}>
			<View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: theme.border }]}>
				<BackHomeButton accessibilityLabel={t("common.back")} />
				{peer ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("chat.viewProfile", { name: peer.displayName })}
						onPress={() => router.push(`/connections/${candidateId}`)}
						style={({ pressed }) => [styles.peer, { opacity: pressed ? 0.7 : 1 }]}
					>
						<UserAvatar imageUrl={peer.photoUrl} name={peer.displayName} size={40} />
						<View style={styles.peerCopy}>
							<ThemedText type="label" numberOfLines={1}>
								{peer.displayName}
							</ThemedText>
							<ThemedText type="caption" style={{ color: peerTyping ? theme.tint : theme.muted }}>
								{peerTyping ? t("chat.typing") : t("chat.viewProfileHint")}
							</ThemedText>
						</View>
					</Pressable>
				) : null}
				{peer
					? (
							[
								{ kind: "report", icon: "flag-outline" },
								{ kind: "block", icon: "ban-outline" },
							] as const
						).map(({ kind, icon }) => (
							<Pressable
								key={kind}
								accessibilityRole="button"
								accessibilityLabel={t(`connections.safety.${kind}`)}
								hitSlop={8}
								onPress={() => setSafetyDialog(kind)}
								style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
							>
								<Ionicons name={icon} size={22} color={theme.danger} />
							</Pressable>
						))
					: null}
			</View>

			{thread.isPending ? (
				<View style={styles.centered}>
					<ActivityIndicator color={theme.tint} />
				</View>
			) : thread.isError ? (
				<View style={[styles.centered, { padding: Spacing.xl }]}>
					<ErrorBanner message={t("auth.errors.network")} />
					<ThemedText type="link" onPress={() => thread.refetch()}>
						{t("common.retry")}
					</ThemedText>
				</View>
			) : (
				<FlatList
					inverted
					data={messages}
					keyExtractor={(message) => String(message.id)}
					renderItem={({ item }) => <MessageBubble message={item} mine={item.senderId !== candidateId} />}
					contentContainerStyle={styles.list}
					onEndReached={() => thread.hasNextPage && !thread.isFetchingNextPage && thread.fetchNextPage()}
					keyboardDismissMode="interactive"
					ListEmptyComponent={
						<ThemedText style={[styles.empty, { color: theme.muted }]}>
							{t("chat.empty", { name: peer?.displayName ?? "" })}
						</ThemedText>
					}
				/>
			)}

			{peer?.isSynthetic ? (
				<View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
					<ThemedText type="caption" style={{ color: theme.muted, textAlign: "center" }}>
						{t("chat.demoNotice")}
					</ThemedText>
				</View>
			) : null}
			{send.isError ? <ErrorBanner message={t("chat.sendError")} /> : null}

			<View style={{ paddingBottom: insets.bottom }}>
				<Composer
					value={draft}
					onChangeText={(value) => {
						setDraft(value);
						sendTyping();
					}}
					onSend={() => send.mutate(draft.trim())}
					disabled={!peer}
				/>
			</View>

			{peer ? (
				<SafetyDialogs
					candidateId={candidateId}
					name={peer.displayName}
					kind={safetyDialog}
					onClose={() => setSafetyDialog(null)}
					onDone={async () => {
						await queryClient.invalidateQueries({ queryKey: matchesQueryKey });
						router.dismissTo("/matches");
					}}
				/>
			) : null}
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		paddingHorizontal: Spacing.lg,
		paddingBottom: Spacing.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	peer: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	peerCopy: {
		flex: 1,
		minWidth: 0,
	},
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.md,
	},
	list: {
		flexGrow: 1,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
	empty: {
		textAlign: "center",
		// Inverted list renders the empty component upside down.
		transform: [{ scaleY: -1 }],
		marginTop: Spacing.xl,
	},
	notice: {
		marginHorizontal: Spacing.lg,
		marginBottom: Spacing.sm,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.md,
	},
});
