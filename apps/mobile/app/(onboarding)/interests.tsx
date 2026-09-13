import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
	label: category.label,
	options: category.interests.map((interest) => ({ value: interest.key, label: interest.label })),
}));

export default function InterestsStep() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { draft, toggleInterest } = useProfileDraft();
	const [error, setError] = useState<string | undefined>(undefined);

	const selectedCount = draft.interests.length;
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
						{error ?? t("onboarding.interests.selected", { count: selectedCount })}
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
		</FormScreen>
	);
}
