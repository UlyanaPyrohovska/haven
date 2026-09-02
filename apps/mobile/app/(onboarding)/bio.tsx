import { useRouter } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { BIO_MAX_LENGTH } from "@/constants/profile-taxonomy";
import { Strings } from "@/constants/strings";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";

const copy = Strings.onboarding.bio;

/** Enough words that the bio embedding has something to work with. */
const BIO_MIN_LENGTH = 20;

export default function BioStep() {
	const router = useRouter();
	const { draft, updateDraft } = useProfileDraft();
	const [error, setError] = useState<string | undefined>(undefined);

	const onContinue = () => {
		if (draft.bio.trim().length < BIO_MIN_LENGTH) {
			setError(copy.tooShort);
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
			title={copy.title}
			subtitle={copy.subtitle}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("bio"))}
			progress={{ current: onboardingStepNumber("bio"), total: ONBOARDING_STEP_COUNT }}
			footer={<Button label={Strings.common.continue} onPress={onContinue} />}
		>
			<TextField
				label={copy.label}
				placeholder={copy.placeholder}
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
