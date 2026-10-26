import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { Spacing } from "@/constants/app-config";
import { useSession } from "@/lib/auth/client";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";
import { ProfilePhotoError, pickProfilePhotoDataUrl } from "@/lib/profile/photo";

/** Optional step: the picked photo stays in the draft and is uploaded when onboarding submits. */
export default function PhotoStep() {
	const { t } = useTranslation();
	const router = useRouter();
	const { data: session } = useSession();
	const { draft, updateDraft } = useProfileDraft();
	const [isPicking, setIsPicking] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	const goNext = () => {
		const next = nextOnboardingRoute("photo");
		if (next) {
			router.replace(next);
		}
	};

	const onPick = async () => {
		setError(undefined);
		setIsPicking(true);

		try {
			const dataUrl = await pickProfilePhotoDataUrl();
			if (dataUrl) {
				updateDraft({ photo: dataUrl });
			}
		} catch (pickError) {
			setError(
				pickError instanceof ProfilePhotoError && pickError.code === "permission_denied"
					? t("profile.photo.permissionDenied")
					: t("profile.photo.uploadError"),
			);
		} finally {
			setIsPicking(false);
		}
	};

	const onSkip = () => {
		updateDraft({ photo: null });
		goNext();
	};

	return (
		<FormScreen
			title={t("onboarding.photo.title")}
			subtitle={t("onboarding.photo.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("photo"))}
			progress={{ current: onboardingStepNumber("photo"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					<ErrorBanner message={error} />
					{draft.photo ? (
						<Button label={t("common.continue")} onPress={goNext} />
					) : (
						<Button label={t("onboarding.photo.choose")} loading={isPicking} onPress={onPick} />
					)}
					<Button label={t("common.skip")} variant="ghost" disabled={isPicking} onPress={onSkip} />
				</>
			}
		>
			<View style={styles.preview}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={draft.photo ? t("profile.photo.change") : t("profile.photo.add")}
					disabled={isPicking}
					onPress={onPick}
					style={({ pressed }) => [{ opacity: pressed || isPicking ? 0.75 : 1 }]}
				>
					<UserAvatar imageUrl={draft.photo} name={session?.user.name} size={160} />
				</Pressable>
				{draft.photo ? (
					<Button label={t("profile.photo.change")} variant="secondary" disabled={isPicking} onPress={onPick} />
				) : null}
			</View>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	preview: {
		alignItems: "center",
		gap: Spacing.md,
		paddingVertical: Spacing.lg,
	},
});
