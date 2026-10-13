import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ProfilePrivacyControls } from "@/components/profile/profile-privacy-controls";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { Radius, Spacing } from "@/constants/app-config";
import { profileQueryKey } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { saveProfile } from "@/lib/api/profile";
import { useSession } from "@/lib/auth/client";
import { profileInitials } from "@/lib/profile/display";
import { draftPublicProfilePreview } from "@/lib/profile/privacy";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import { ONBOARDING_STEP_COUNT, onboardingStepNumber, previousOnboardingRoute } from "@/lib/onboarding/steps";

function PreviewTag({ label }: { label: string }) {
	const theme = useTheme();

	return (
		<View style={[styles.tag, { backgroundColor: theme.accentSoft, borderColor: theme.tint }]}>
			<ThemedText type="caption" style={{ color: theme.tint }}>
				{label}
			</ThemedText>
		</View>
	);
}

export default function PrivacyStep() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const { draft, setPrivacySetting, reset } = useProfileDraft();

	const displayName = session?.user.name?.trim() || t("profile.fallbackName");
	const preview = useMemo(() => draftPublicProfilePreview(draft), [draft]);
	const initials = profileInitials(displayName);

	const submit = useMutation({
		mutationFn: () => saveProfile(draft),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: profileQueryKey });
			reset();
			router.replace("/home");
		},
	});

	return (
		<FormScreen
			title={t("onboarding.privacy.title")}
			subtitle={t("onboarding.privacy.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("privacy"))}
			progress={{ current: onboardingStepNumber("privacy"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					<ErrorBanner message={submit.isError ? t("onboarding.submit.error") : undefined} />
					<Button label={t("common.finish")} loading={submit.isPending} onPress={() => submit.mutate()} />
				</>
			}
		>
			<View style={styles.previewBlock}>
				<ThemedText type="label">{t("onboarding.privacy.previewTitle")}</ThemedText>
				<ThemedText type="caption" style={{ color: theme.muted }}>
					{t("onboarding.privacy.previewSubtitle")}
				</ThemedText>

				<View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
					<View style={[styles.previewAvatar, { backgroundColor: theme.accentSoft }]}>
						<ThemedText type="title" style={{ color: theme.tint }}>
							{initials}
						</ThemedText>
					</View>

					<View style={styles.previewCopy}>
						<ThemedText type="label">{displayName}</ThemedText>
						{preview.ageLabel ? (
							<ThemedText type="caption" style={{ color: theme.muted }}>
								{preview.ageLabel}
							</ThemedText>
						) : null}
						{preview.career ? (
							<ThemedText type="caption" style={{ color: theme.muted }}>
								{preview.career}
							</ThemedText>
						) : null}
						{preview.interests.length > 0 ? (
							<View style={styles.tagRow}>
								{preview.interests.slice(0, 4).map((interest) => (
									<PreviewTag key={interest} label={interest} />
								))}
								{preview.interests.length > 4 ? (
									<ThemedText type="caption" style={{ color: theme.muted, alignSelf: "center" }}>
										{t("onboarding.privacy.moreInterests", { count: preview.interests.length - 4 })}
									</ThemedText>
								) : null}
							</View>
						) : null}
						{preview.bio ? (
							<ThemedText style={{ color: theme.text, lineHeight: 22 }} numberOfLines={4}>
								{preview.bio}
							</ThemedText>
						) : (
							<ThemedText type="caption" style={{ color: theme.muted }}>
								{t("onboarding.privacy.previewEmpty")}
							</ThemedText>
						)}
					</View>
				</View>

				{!draft.privacy.discoverable ? (
					<ThemedText type="caption" style={{ color: theme.muted }}>
						{t("onboarding.privacy.hiddenFromRecommendations")}
					</ThemedText>
				) : null}
			</View>

			<ProfilePrivacyControls privacy={draft.privacy} onToggle={setPrivacySetting} disabled={submit.isPending} />
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	previewBlock: {
		gap: Spacing.sm,
	},
	previewCard: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.lg,
		flexDirection: "row",
		gap: Spacing.md,
	},
	previewAvatar: {
		width: 72,
		height: 72,
		borderRadius: Radius.lg,
		alignItems: "center",
		justifyContent: "center",
	},
	previewCopy: {
		flex: 1,
		gap: Spacing.xs,
	},
	tagRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.xs,
		marginTop: Spacing.xs,
	},
	tag: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 2,
	},
});
