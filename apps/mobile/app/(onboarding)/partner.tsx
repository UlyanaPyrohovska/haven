import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { PartnerFilters } from "@/components/profile/partner-filters";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { ScaleLegend } from "@/components/ui/scale-legend";
import { SliderScale } from "@/components/ui/slider-scale";
import { Spacing } from "@/constants/app-config";
import {
	AGE_FILTER_DEFAULT_SPREAD,
	AGE_FILTER_MAX,
	AGE_FILTER_MIN,
	TraitDimensions,
} from "@/constants/profile-taxonomy";
import { useTheme } from "@/hooks/use-theme";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";
import { ageFromBirthDateString } from "@/lib/profile/display";

/** Starts the age filter around the user's own age, so the first range is a sensible guess. */
function defaultAgeRange(birthDate: string | undefined) {
	const age = birthDate ? ageFromBirthDateString(birthDate) : undefined;

	if (age === undefined) {
		return { min: AGE_FILTER_MIN, max: AGE_FILTER_MAX };
	}

	return {
		min: Math.max(AGE_FILTER_MIN, age - AGE_FILTER_DEFAULT_SPREAD),
		max: Math.min(AGE_FILTER_MAX, age + AGE_FILTER_DEFAULT_SPREAD),
	};
}

export default function PartnerStep() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { draft, setPartnerImportance, updateDraft } = useProfileDraft();
	const [error, setError] = useState<string | undefined>(undefined);
	const [showMeError, setShowMeError] = useState<string | undefined>(undefined);

	const ageRange = draft.ageRange ?? defaultAgeRange(draft.birthDate);
	const allSet = TraitDimensions.every((dimension) => draft.partner[dimension.prefKey] !== undefined);

	const onContinue = () => {
		const nextShowMeError = draft.interestedIn.length === 0 ? t("onboarding.partner.showMeInvalid") : undefined;
		setShowMeError(nextShowMeError);
		setError(allSet ? undefined : t("onboarding.partner.incomplete"));

		if (nextShowMeError || !allSet) {
			return;
		}

		// Persist the shown default even if the user never touched the range.
		updateDraft({ ageRange });
		const next = nextOnboardingRoute("partner");

		if (next) {
			router.replace(next);
		}
	};

	return (
		<FormScreen
			title={t("onboarding.partner.title")}
			subtitle={t("onboarding.partner.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("partner"))}
			progress={{ current: onboardingStepNumber("partner"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					{/* The footer stays visible, so it repeats the "Show me" error the user may have scrolled past. */}
					{showMeError || error ? (
						<ThemedText type="caption" style={{ color: theme.danger }}>
							{showMeError ?? error}
						</ThemedText>
					) : null}
					<Button label={t("common.continue")} onPress={onContinue} />
				</>
			}
		>
			<PartnerFilters
				interestedIn={draft.interestedIn}
				onInterestedInChange={(interestedIn) => {
					updateDraft({ interestedIn });
					setShowMeError(undefined);
				}}
				ageRange={ageRange}
				onAgeRangeChange={(next) => updateDraft({ ageRange: next })}
				error={showMeError}
			/>

			<View style={styles.heading}>
				<ThemedText type="subtitle">{t("onboarding.partner.rankingTitle")}</ThemedText>
				<ThemedText type="caption" style={{ color: theme.muted }}>
					{t("onboarding.partner.rankingHint")}
				</ThemedText>
			</View>
			<ScaleLegend low={t("onboarding.partner.low")} high={t("onboarding.partner.high")} />

			{TraitDimensions.map((dimension) => (
				<SliderScale
					key={dimension.prefKey}
					label={dimension.label}
					emoji={dimension.emoji}
					levels={t("onboarding.partner.levels", { returnObjects: true }) as string[]}
					value={draft.partner[dimension.prefKey]}
					onChange={(value) => {
						setPartnerImportance(dimension.prefKey, value);
						setError(undefined);
					}}
				/>
			))}
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	heading: {
		gap: Spacing.xs,
		marginTop: Spacing.md,
	},
});
