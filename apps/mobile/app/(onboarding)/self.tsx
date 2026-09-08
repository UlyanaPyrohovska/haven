import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { ScaleLegend } from "@/components/ui/scale-legend";
import { SliderScale } from "@/components/ui/slider-scale";
import { SelfDimensions } from "@/constants/profile-taxonomy";
import { profileQueryKey } from "@/hooks/use-profile";
import { saveProfile } from "@/lib/api/profile";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import { ONBOARDING_STEP_COUNT, onboardingStepNumber, previousOnboardingRoute } from "@/lib/onboarding/steps";

export default function SelfStep() {
	const { t } = useTranslation();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { draft, setSelfRating, reset } = useProfileDraft();

	const submit = useMutation({
		mutationFn: () => saveProfile(draft),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: profileQueryKey });
			reset();
			router.replace("/home");
		},
	});

	const allRated = SelfDimensions.every((dimension) => draft.self[dimension.selfKey] !== undefined);

	return (
		<FormScreen
			title={t("onboarding.self.title")}
			subtitle={t("onboarding.self.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("self"))}
			progress={{ current: onboardingStepNumber("self"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					<ErrorBanner message={submit.isError ? t("onboarding.submit.error") : undefined} />
					<Button
						label={t("common.finish")}
						disabled={!allRated}
						loading={submit.isPending}
						onPress={() => submit.mutate()}
					/>
				</>
			}
		>
			<ScaleLegend low={t("onboarding.self.low")} high={t("onboarding.self.high")} />

			{SelfDimensions.map((dimension) => (
				<SliderScale
					key={dimension.selfKey}
					label={dimension.label}
					value={draft.self[dimension.selfKey]}
					onChange={(value) => setSelfRating(dimension.selfKey, value)}
				/>
			))}
		</FormScreen>
	);
}
