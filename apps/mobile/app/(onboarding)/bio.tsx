import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { BIO_MAX_LENGTH } from "@/constants/profile-taxonomy";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";

/** Enough words that the bio embedding has something to work with. */
const BIO_MIN_LENGTH = 20;

export default function BioStep() {
	const { t } = useTranslation();
	const router = useRouter();
	const { draft, updateDraft } = useProfileDraft();
	const [error, setError] = useState<string | undefined>(undefined);

	const onContinue = () => {
		if (draft.bio.trim().length < BIO_MIN_LENGTH) {
			setError(t("onboarding.bio.tooShort"));
			return;
		}

		setError(undefined);
		const next = nextOnboardingRoute("bio");
		if (next) {
			router.replace(next);
		}
	};

	return (
		<FormScreen
			title={t("onboarding.bio.title")}
			subtitle={t("onboarding.bio.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("bio"))}
			progress={{ current: onboardingStepNumber("bio"), total: ONBOARDING_STEP_COUNT }}
			footer={<Button label={t("common.continue")} onPress={onContinue} />}
		>
			<TextField
				label={t("onboarding.bio.label")}
				placeholder={t("onboarding.bio.placeholder")}
				value={draft.bio}
				onChangeText={(bio) => updateDraft({ bio })}
				error={error}
				maxLength={BIO_MAX_LENGTH}
				showCounter
				multiline
			/>
		</FormScreen>
	);
}
