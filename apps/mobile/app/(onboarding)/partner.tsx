import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { ScaleLegend } from "@/components/ui/scale-legend";
import { SliderScale } from "@/components/ui/slider-scale";
import { TraitDimensions } from "@/constants/profile-taxonomy";
import { useTheme } from "@/hooks/use-theme";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";

export default function PartnerStep() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { draft, setPartnerImportance } = useProfileDraft();
	const [error, setError] = useState<string | undefined>(undefined);

	const allSet = TraitDimensions.every((dimension) => draft.partner[dimension.prefKey] !== undefined);

	const onContinue = () => {
		if (!allSet) {
			setError(t("onboarding.partner.incomplete"));
			return;
		}

		setError(undefined);
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
					{error ? (
						<ThemedText type="caption" style={{ color: theme.danger }}>
							{error}
						</ThemedText>
					) : null}
					<Button label={t("common.continue")} onPress={onContinue} />
				</>
			}
		>
			<ScaleLegend low={t("onboarding.partner.low")} high={t("onboarding.partner.high")} />

			{TraitDimensions.map((dimension) => (
				<SliderScale
					key={dimension.prefKey}
					label={dimension.label}
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
