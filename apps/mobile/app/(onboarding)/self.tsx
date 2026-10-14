import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { ScaleLegend } from "@/components/ui/scale-legend";
import { SliderScale } from "@/components/ui/slider-scale";
import { SelfDimensions } from "@/constants/profile-taxonomy";
import { useTheme } from "@/hooks/use-theme";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";

export default function SelfStep() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { draft, setSelfRating } = useProfileDraft();
	const [error, setError] = useState<string | undefined>(undefined);

	const allRated = SelfDimensions.every((dimension) => draft.self[dimension.selfKey] !== undefined);

	const onContinue = () => {
		if (!allRated) {
			setError(t("onboarding.self.incomplete"));
			return;
		}

		setError(undefined);
		const next = nextOnboardingRoute("self");

		if (next) {
			router.replace(next);
		}
	};

	return (
		<FormScreen
			title={t("onboarding.self.title")}
			subtitle={t("onboarding.self.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("self"))}
			progress={{ current: onboardingStepNumber("self"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					{error ? (
						<ThemedText type="caption" style={{ color: theme.danger }}>
							{error}
						</ThemedText>
					) : null}
					<Button label={t("common.continue")} onPress={onContinue} />
				</>
			}
		>
			<ScaleLegend low={t("onboarding.self.low")} high={t("onboarding.self.high")} />

			{SelfDimensions.map((dimension) => (
				<SliderScale
					key={dimension.selfKey}
					label={dimension.label}
					emoji={dimension.emoji}
					levels={t("onboarding.self.levels", { returnObjects: true }) as string[]}
					value={draft.self[dimension.selfKey]}
					onChange={(value) => {
						setSelfRating(dimension.selfKey, value);
						setError(undefined);
					}}
				/>
			))}
		</FormScreen>
	);
}
