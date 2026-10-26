import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { fetchTodayDailyQuestion, todayDailyQuestionQueryKey } from "@/lib/api/daily-question";
import { fetchTodayMood, todayMoodQueryKey } from "@/lib/api/mood";
import { registerPushToken, unregisterPushToken } from "@/lib/api/notifications";
import { matchesQueryKey } from "@/lib/api/recommendations";
import i18n from "@/lib/i18n";

/** Must match the API's `ANDROID_CHANNEL_ID`. */
const CHANNEL_ID = "default";
const REMINDER_ID = "daily-reminder";
const REMINDER_HOUR = 19;

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

let registeredToken: string | null = null;
const handledResponses = new Set<string>();

async function ensurePermission(): Promise<boolean> {
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
			name: i18n.t("notifications.channelName"),
			importance: Notifications.AndroidImportance.HIGH,
		});
	}

	const current = await Notifications.getPermissionsAsync();

	if (current.granted || !current.canAskAgain) {
		return current.granted;
	}

	return (await Notifications.requestPermissionsAsync()).granted;
}

async function register(token: string) {
	await registerPushToken(token, Platform.OS === "ios" ? "ios" : "android");
	registeredToken = token;
}

/** Asks once, then sends this device's native FCM/APNs token to the API. Best effort: push is optional. */
export async function startPushNotifications(): Promise<void> {
	if (Platform.OS === "web" || !(await ensurePermission())) {
		return;
	}

	try {
		const { data } = await Notifications.getDevicePushTokenAsync();
		await register(data as string);
	} catch (err) {
		console.warn("push registration failed", err);
	}
}

/** Call before signing out, while the session cookie still works. */
export async function stopNotifications(): Promise<void> {
	await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

	if (registeredToken) {
		await unregisterPushToken(registeredToken).catch(() => {});
		registeredToken = null;
	}
}

/** Today at the reminder hour while it is still ahead and something is left to do, else tomorrow. */
export function nextReminderAt(now: Date, doneToday: boolean): Date {
	const at = new Date(now);
	at.setHours(REMINDER_HOUR, 0, 0, 0);

	if (doneToday || at <= now) {
		at.setDate(at.getDate() + 1);
	}

	return at;
}

/**
 * One gentle local reminder for the daily question and mood check-in, re-planned on each visit,
 * so a user who stays away gets a single nudge, not one per day.
 */
async function scheduleDailyReminder(doneToday: boolean) {
	await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});

	if (!(await Notifications.getPermissionsAsync()).granted) {
		return;
	}

	await Notifications.scheduleNotificationAsync({
		identifier: REMINDER_ID,
		content: {
			title: i18n.t("notifications.reminder.title"),
			body: i18n.t("notifications.reminder.body"),
			data: { type: "reminder" },
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: nextReminderAt(new Date(), doneToday),
			channelId: CHANNEL_ID,
		},
	});
}

function hrefFor(data: Record<string, unknown>): Href | null {
	switch (data.type) {
		case "message":
			return `/matches/${data.candidateId}` as Href;
		case "match":
			return `/connections/${data.candidateId}` as Href;
		case "recommendations":
			return "/connections" as Href;
		case "reminder":
			return "/daily-question" as Href;
		default:
			return null;
	}
}

/**
 * Mounted on home (signed in, profile complete): registers push, plans the reminder, routes notification taps,
 * and refetches matches when a match push arrives in the foreground. Home stays mounted under the matches stack.
 */
export function useNotifications() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const lastResponse = Notifications.useLastNotificationResponse();
	const question = useQuery({ queryKey: todayDailyQuestionQueryKey, queryFn: fetchTodayDailyQuestion });
	const mood = useQuery({ queryKey: todayMoodQueryKey, queryFn: fetchTodayMood });

	useEffect(() => {
		void startPushNotifications();
		const subscription = Notifications.addPushTokenListener(({ data }) => {
			void register(data as string).catch(() => {});
		});

		return () => subscription.remove();
	}, []);

	// A like answered while the app is open: refetch now so the focused screen (home or matches) celebrates it.
	useEffect(() => {
		const subscription = Notifications.addNotificationReceivedListener((notification) => {
			if (notification.request.content.data?.type === "match") {
				void queryClient.invalidateQueries({ queryKey: matchesQueryKey });
			}
		});

		return () => subscription.remove();
	}, [queryClient]);

	const doneToday = question.data ? question.data.answer !== null && mood.data?.mood != null : null;

	useEffect(() => {
		if (doneToday !== null && mood.data) {
			void scheduleDailyReminder(doneToday).catch(() => {});
		}
	}, [doneToday, mood.data]);

	useEffect(() => {
		const id = lastResponse?.notification.request.identifier;

		// The hook keeps returning the last tap, so each one routes only once.
		if (!lastResponse || !id || handledResponses.has(id)) {
			return;
		}

		handledResponses.add(id);
		const href = hrefFor(lastResponse.notification.request.content.data ?? {});

		if (href) {
			router.push(href);
		}
	}, [lastResponse, router]);
}
