import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CustomInterestPicker } from "@/components/profile/custom-interest-picker";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { MultiChipGroup } from "@/components/ui/chip-group";
import { FormScreen } from "@/components/ui/form-screen";
import { InterestCategories, type InterestKey, MIN_SELECTED_INTERESTS } from "@/constants/profile-taxonomy";
import { useTheme } from "@/hooks/use-theme";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";

/** Chip options keyed by column name, built once since the taxonomy is static. */
const categories = InterestCategories.map((category) => ({
	key: category.key,
	label: `${category.emoji} ${category.label}`,
	options: category.interests.map((interest) => ({
		value: interest.key,
		label: interest.label,
		emoji: interest.emoji,
	})),
}));

export default function InterestsStep() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { draft, toggleInterest, updateDraft } = useProfileDraft();
	const [error, setError] = useState<string | undefined>(undefined);

	const selectedCount = draft.interests.length + draft.customInterests.length;
	const hasEnough = selectedCount >= MIN_SELECTED_INTERESTS;

	const onContinue = () => {
		if (!hasEnough) {
			setError(t("onboarding.interests.tooFew", { count: MIN_SELECTED_INTERESTS }));
			return;
		}

		setError(undefined);
		const next = nextOnboardingRoute("interests");

		if (next) {
			router.replace(next);
		}
	};

	return (
		<FormScreen
			title={t("onboarding.interests.title")}
			subtitle={t("onboarding.interests.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("interests"))}
			progress={{ current: onboardingStepNumber("interests"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					<ThemedText type="caption" style={{ color: error ? theme.danger : theme.muted }}>
						{error ??
							t(hasEnough ? "onboarding.interests.enough" : "onboarding.interests.selected", {
								count: selectedCount,
							})}
					</ThemedText>
					<Button label={t("common.continue")} onPress={onContinue} />
				</>
			}
		>
			{categories.map((category) => (
				<MultiChipGroup<InterestKey>
					key={category.key}
					label={category.label}
					options={category.options}
					values={draft.interests}
					onToggle={(key) => {
						toggleInterest(key);
						setError(undefined);
					}}
				/>
			))}

			<CustomInterestPicker
				values={draft.customInterests}
				onChange={(customInterests) => {
					updateDraft({ customInterests });
					setError(undefined);
				}}
			/>
		</FormScreen>
	);
}
