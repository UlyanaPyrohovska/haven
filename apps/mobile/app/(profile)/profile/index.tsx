import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { Radius, Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { useProfileQuery } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import {
	profileAge,
	profileEthnicityLabel,
	profileGenderLabel,
	profileInitials,
	profileLookingForLabel,
	profileSelectedInterests,
	profileSelfRatings,
} from "@/lib/profile-display";
import { useSession } from "@/lib/auth-client";

const copy = Strings.profile;

function DetailRow({ label, value }: { label: string; value: string }) {
	const theme = useTheme();

	return (
		<View style={styles.detailRow}>
			<ThemedText type="caption" style={{ color: theme.muted }}>
				{label}
			</ThemedText>
			<ThemedText type="label">{value}</ThemedText>
		</View>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View style={styles.section}>
			<ThemedText type="label">{title}</ThemedText>
			{children}
		</View>
	);
}

export default function ProfileScreen() {
	const router = useRouter();
	const theme = useTheme();
	const { data: session } = useSession();
	const profile = useProfileQuery(true);

	if (profile.isPending) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<ActivityIndicator color={theme.tint} />
			</View>
		);
	}

	if (profile.isError) {
		return (
			<FormScreen title={copy.title} showBack>
				<ErrorBanner message={Strings.auth.errors.network} />
				<ThemedText type="link" onPress={() => profile.refetch()}>
					{Strings.common.retry}
				</ThemedText>
			</FormScreen>
		);
	}

	const data = profile.data;
	const displayName = session?.user.name?.trim() || copy.fallbackName;
	const initials = profileInitials(displayName);
	const age = data ? profileAge(data) : undefined;
	const gender = data ? profileGenderLabel(data) : undefined;
	const ethnicity = data ? profileEthnicityLabel(data) : undefined;
	const career = typeof data?.career === "string" ? data.career.trim() : "";
	const lookingForLabel = data ? profileLookingForLabel(data) : undefined;
	const goal = typeof data?.goal === "string" ? data.goal.trim() : "";
	const bio = typeof data?.bio === "string" ? data.bio.trim() : "";
	const interests = data ? profileSelectedInterests(data) : [];
	const selfRatings = data ? profileSelfRatings(data) : [];

	const detailRows: { label: string; value: string }[] = [];

	if (age !== undefined) detailRows.push({ label: copy.age, value: copy.ageValue(age) });
	if (gender) detailRows.push({ label: copy.gender, value: gender });
	if (ethnicity) detailRows.push({ label: copy.ethnicity, value: ethnicity });
	if (career) detailRows.push({ label: copy.career, value: career });
	if (goal) detailRows.push({ label: copy.goal, value: goal });

	return (
		<FormScreen title={copy.title} showBack>
			<View style={styles.hero}>
				<View style={[styles.avatar, { backgroundColor: theme.accentSoft, borderColor: theme.tint }]}>
					<ThemedText type="title" style={{ color: theme.tint }}>
						{initials}
					</ThemedText>
				</View>
				<ThemedText type="subtitle" style={styles.name}>
					{displayName}
				</ThemedText>
				{lookingForLabel ? (
					<View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.tint }]}>
						<ThemedText type="caption" style={{ color: theme.tint }}>
							{lookingForLabel}
						</ThemedText>
					</View>
				) : null}
				{goal ? (
					<ThemedText style={{ color: theme.muted, textAlign: "center" }}>{goal}</ThemedText>
				) : null}
			</View>

			<Section title={copy.manage}>
				<MenuCard>
					<MenuRow label={copy.edit} subtitle={copy.editSubtitle} onPress={() => router.push("/profile/edit")} />
					<MenuDivider />
					<MenuRow
						label={copy.settings}
						subtitle={copy.settingsSubtitle}
						onPress={() => router.push("/profile/settings")}
					/>
				</MenuCard>
			</Section>

			{bio ? (
				<Section title={copy.about}>
					<ThemedText style={{ color: theme.muted, lineHeight: 24 }}>{bio}</ThemedText>
				</Section>
			) : null}

			{detailRows.length > 0 ? (
				<Section title={copy.details}>
					<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						{detailRows.map((row, index) => (
							<View key={row.label}>
								<DetailRow label={row.label} value={row.value} />
								{index < detailRows.length - 1 ? (
									<View style={[styles.divider, { backgroundColor: theme.border }]} />
								) : null}
							</View>
						))}
					</View>
				</Section>
			) : null}

			{interests.length > 0 ? (
				<Section title={copy.interests}>
					<View style={styles.chips}>
						{interests.map((interest) => (
							<View
								key={interest}
								style={[styles.chip, { backgroundColor: theme.field, borderColor: theme.border }]}
							>
								<ThemedText type="caption">{interest}</ThemedText>
							</View>
						))}
					</View>
				</Section>
			) : null}

			{selfRatings.length > 0 ? (
				<Section title={copy.personality}>
					<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						{selfRatings.map((rating, index) => (
							<View key={rating.label}>
								<DetailRow label={rating.label} value={copy.ratingValue(rating.value)} />
								{index < selfRatings.length - 1 ? (
									<View style={[styles.divider, { backgroundColor: theme.border }]} />
								) : null}
							</View>
						))}
					</View>
				</Section>
			) : null}
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	hero: {
		alignItems: "center",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	avatar: {
		width: 88,
		height: 88,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	name: {
		textAlign: "center",
	},
	badge: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
	},
	section: {
		gap: Spacing.sm,
	},
	card: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
	},
	detailRow: {
		gap: Spacing.xs,
		paddingVertical: Spacing.md,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
	},
	chips: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
	chip: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
	},
});
