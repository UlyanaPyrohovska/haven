import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ModeIcon } from "@/components/ui/mode-badge";
import { Radius, Spacing } from "@/constants/app-config";
import { useMode } from "@/hooks/use-mode";
import { useTheme } from "@/hooks/use-theme";

const AVATAR_SIZE = 120;
const PARTICLES = 14;

type MatchCelebrationProps = {
	visible: boolean;
	name: string;
	photoUrl?: string | null;
	title: string;
	message: string;
	confirmLabel: string;
	onConfirm: () => void;
	cancelLabel?: string;
	onCancel?: () => void;
};

/** Full-screen match moment: the avatar springs in, mode icons burst outward, then the copy and actions rise. */
export function MatchCelebration({
	visible,
	name,
	photoUrl,
	title,
	message,
	confirmLabel,
	onConfirm,
	cancelLabel,
	onCancel,
}: MatchCelebrationProps) {
	const theme = useTheme();
	const mode = useMode();
	const reduceMotion = useReducedMotion();
	const icon = mode ? ModeIcon[mode] : "heart";
	const avatar = useSharedValue(0);
	const burst = useSharedValue(0);
	const badge = useSharedValue(0);
	const content = useSharedValue(0);
	const halo = useSharedValue(0);

	useEffect(() => {
		if (!visible) {
			for (const value of [avatar, burst, badge, content, halo]) {
				cancelAnimation(value);
				value.value = 0;
			}
			return;
		}

		void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

		if (reduceMotion) {
			avatar.value = 1;
			badge.value = 1;
			content.value = 1;
			burst.value = 1;
			return;
		}

		avatar.value = withDelay(80, withSpring(1, { damping: 9, stiffness: 160 }));
		burst.value = withDelay(180, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
		badge.value = withDelay(480, withSpring(1, { damping: 8, stiffness: 220 }));
		content.value = withDelay(380, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
		halo.value = withDelay(
			600,
			withRepeat(
				withSequence(
					withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
					withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
				),
				-1,
			),
		);
	}, [avatar, badge, burst, content, halo, reduceMotion, visible]);

	const avatarStyle = useAnimatedStyle(() => ({
		opacity: Math.min(1, avatar.value * 2),
		transform: [{ scale: avatar.value }],
	}));
	const haloStyle = useAnimatedStyle(() => ({
		opacity: 0.35 + 0.25 * halo.value,
		transform: [{ scale: avatar.value * (1.12 + 0.1 * halo.value) }],
	}));
	const ringStyle = useAnimatedStyle(() => ({
		opacity: Math.min(1, burst.value * 6) * (1 - burst.value),
		transform: [{ scale: 0.8 + burst.value * 1.6 }],
	}));
	const badgeStyle = useAnimatedStyle(() => ({
		transform: [{ scale: badge.value }, { rotate: `${(1 - badge.value) * -45}deg` }],
	}));
	const contentStyle = useAnimatedStyle(() => ({
		opacity: content.value,
		transform: [{ translateY: (1 - content.value) * 24 }],
	}));

	const dismiss = onCancel ?? onConfirm;

	return (
		<Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
			<View style={styles.root}>
				<Pressable
					accessibilityLabel={cancelLabel ?? confirmLabel}
					style={[styles.backdrop, { backgroundColor: theme.scrim }]}
					onPress={dismiss}
				/>

				<View
					accessibilityRole="alert"
					accessibilityViewIsModal
					style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}
				>
					<View style={styles.stage}>
						{Array.from({ length: PARTICLES }, (_, index) => (
							<Particle
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size decorative list
								key={index}
								index={index}
								progress={burst}
								icon={icon}
								color={index % 3 === 0 ? theme.accentSoft : theme.tint}
							/>
						))}
						<Animated.View style={[styles.ring, { borderColor: theme.tint }, ringStyle]} />
						<Animated.View style={[styles.halo, { backgroundColor: theme.tint }, haloStyle]} />
						<Animated.View style={avatarStyle}>
							<UserAvatar imageUrl={photoUrl} name={name} size={AVATAR_SIZE} />
						</Animated.View>
						<Animated.View
							style={[styles.badge, { backgroundColor: theme.tint, borderColor: theme.background }, badgeStyle]}
						>
							<Ionicons name={icon} size={20} color={theme.onTint} />
						</Animated.View>
					</View>

					<Animated.View style={[styles.content, contentStyle]}>
						<ThemedText type="subtitle" style={styles.centered}>
							{title}
						</ThemedText>
						<ThemedText style={[styles.centered, { color: theme.muted }]}>{message}</ThemedText>
						<View style={styles.actions}>
							<Button label={confirmLabel} onPress={onConfirm} />
							{cancelLabel && onCancel ? <Button label={cancelLabel} variant="ghost" onPress={onCancel} /> : null}
						</View>
					</Animated.View>
				</View>
			</View>
		</Modal>
	);
}

type ParticleProps = {
	index: number;
	progress: SharedValue<number>;
	icon: keyof typeof Ionicons.glyphMap;
	color: string;
};

/** One icon flying out from the avatar; angle, distance and size vary by index so the burst looks organic. */
function Particle({ index, progress, icon, color }: ParticleProps) {
	const angle = (index / PARTICLES) * Math.PI * 2 + (index % 2) * 0.2;
	const distance = 95 + (index % 4) * 18;
	const size = 14 + (index % 3) * 5;
	const spin = (index % 2 === 0 ? 1 : -1) * 120;

	const style = useAnimatedStyle(() => {
		const p = progress.value;

		return {
			opacity: Math.min(1, p * 8) * (1 - p),
			transform: [
				{ translateX: Math.cos(angle) * distance * p },
				// A little gravity: particles drift down as they fade.
				{ translateY: Math.sin(angle) * distance * p + 30 * p * p },
				{ rotate: `${spin * p}deg` },
				{ scale: 0.5 + 0.7 * (1 - Math.abs(0.4 - p)) },
			],
		};
	});

	return (
		<Animated.View pointerEvents="none" style={[styles.particle, style]}>
			<Ionicons name={icon} size={size} color={color} />
		</Animated.View>
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
		gap: Spacing.lg,
		elevation: 8,
		shadowColor: "#000000",
		shadowOpacity: 0.18,
		shadowRadius: 24,
		shadowOffset: { width: 0, height: 8 },
	},
	stage: {
		width: AVATAR_SIZE + 40,
		height: AVATAR_SIZE + 40,
		alignItems: "center",
		justifyContent: "center",
	},
	particle: {
		position: "absolute",
	},
	ring: {
		position: "absolute",
		width: AVATAR_SIZE,
		height: AVATAR_SIZE,
		borderRadius: Radius.pill,
		borderWidth: 3,
	},
	halo: {
		position: "absolute",
		width: AVATAR_SIZE,
		height: AVATAR_SIZE,
		borderRadius: Radius.pill,
	},
	badge: {
		position: "absolute",
		right: 14,
		bottom: 14,
		width: 40,
		height: 40,
		borderRadius: Radius.pill,
		borderWidth: 3,
		alignItems: "center",
		justifyContent: "center",
	},
	content: {
		alignSelf: "stretch",
		alignItems: "center",
		gap: Spacing.md,
	},
	centered: {
		textAlign: "center",
	},
	actions: {
		alignSelf: "stretch",
		marginTop: Spacing.sm,
		gap: Spacing.sm,
	},
});
