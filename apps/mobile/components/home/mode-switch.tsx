import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Dialog } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ModeIcon } from "@/components/ui/mode-badge";
import { type AppMode, Radius, Spacing } from "@/constants/app-config";
import { type GoalValue, isGoalValidForLookingFor, LookingFor } from "@/constants/profile-taxonomy";
import { useMode } from "@/hooks/use-mode";
import { mergeProfileCache, profileQueryKey } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { type ProfileRecord, saveProfileSettings } from "@/lib/api/profile";
import { matchesQueryKey, recommendationsQueryKey } from "@/lib/api/recommendations";

const MODES: readonly AppMode[] = ["friends", "dating"];

/** Friends | Dating segmented switch. Switching moves the user to the other recommendation pool. */
export function ModeSwitch() {
	const { t } = useTranslation();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const mode = useMode();
	const [target, setTarget] = useState<AppMode | null>(null);
	const [segmentWidth, setSegmentWidth] = useState(0);
	const thumbX = useSharedValue(0);

	useEffect(() => {
		thumbX.value = withTiming(mode === "dating" ? segmentWidth : 0, { duration: 220 });
	}, [mode, segmentWidth, thumbX]);

	const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.value }] }));

	const switchMode = useMutation({
		mutationFn: (next: AppMode) => {
			const lookingFor = LookingFor[next];
			const goal = queryClient.getQueryData<ProfileRecord | null>(profileQueryKey)?.goal;
			// The API rejects a goal from the other mode, so clear it when it no longer fits.
			const keepGoal = typeof goal === "string" && isGoalValidForLookingFor(goal as GoalValue, lookingFor);

			return saveProfileSettings(keepGoal ? { lookingFor } : { lookingFor, goal: null });
		},
		onSuccess: async (profile, next) => {
			mergeProfileCache(queryClient, { lookingFor: LookingFor[next] }, profile);
			setTarget(null);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: recommendationsQueryKey }),
				queryClient.invalidateQueries({ queryKey: matchesQueryKey }),
			]);
		},
	});

	if (!mode) {
		return null;
	}

	const closeDialog = () => {
		setTarget(null);
		switchMode.reset();
	};

	return (
		<>
			<View
				style={[styles.track, { backgroundColor: theme.field, borderColor: theme.border }]}
				onLayout={(event) => setSegmentWidth((event.nativeEvent.layout.width - 2 * TRACK_PADDING) / 2)}
			>
				{segmentWidth > 0 ? (
					<Animated.View style={[styles.thumb, { width: segmentWidth, backgroundColor: theme.tint }, thumbStyle]} />
				) : null}
				{MODES.map((item) => {
					const selected = item === mode;
					const color = selected ? theme.onTint : theme.muted;

					return (
						<Pressable
							key={item}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							accessibilityLabel={t("mode.switchA11y", { mode: t(`mode.${item}`) })}
							onPress={() => (selected ? undefined : setTarget(item))}
							style={styles.segment}
						>
							<Ionicons name={ModeIcon[item]} size={16} color={color} />
							<ThemedText type="bodySemiBold" style={{ color }}>
								{t(`mode.${item}`)}
							</ThemedText>
						</Pressable>
					);
				})}
			</View>

			<Dialog
				visible={target !== null}
				icon={target ? ModeIcon[target] : undefined}
				title={t("mode.switchTitle", { mode: target ? t(`mode.${target}`) : "" })}
				message={t("mode.switchMessage", { context: target ?? undefined })}
				confirmLabel={t("mode.switchConfirm")}
				onConfirm={() => target && switchMode.mutate(target)}
				cancelLabel={t("common.cancel")}
				onCancel={closeDialog}
				loading={switchMode.isPending}
			>
				{switchMode.isError ? <ErrorBanner message={t("mode.switchError")} /> : null}
			</Dialog>
		</>
	);
}

const TRACK_PADDING = 4;

const styles = StyleSheet.create({
	track: {
		flexDirection: "row",
		padding: TRACK_PADDING,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
	},
	thumb: {
		position: "absolute",
		top: TRACK_PADDING,
		bottom: TRACK_PADDING,
		left: TRACK_PADDING,
		borderRadius: Radius.pill,
	},
	segment: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		paddingVertical: Spacing.sm,
	},
});
