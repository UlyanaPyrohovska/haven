import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { ScaleLegend } from "@/components/ui/scale-legend";
import { SliderScale } from "@/components/ui/slider-scale";
import { SelfDimensions } from "@/constants/profile-taxonomy";
import { Strings } from "@/constants/strings";
import { profileQueryKey } from "@/hooks/use-profile";
import { saveProfile } from "@/lib/api/profile";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import { ONBOARDING_STEP_COUNT, onboardingStepNumber, previousOnboardingRoute } from "@/lib/onboarding/steps";

const copy = Strings.onboarding.self;

export default function SelfStep() {
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
			title={copy.title}
			subtitle={copy.subtitle}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("self"))}
			progress={{ current: onboardingStepNumber("self"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					<ErrorBanner message={submit.isError ? Strings.onboarding.submit.error : undefined} />
					<Button
						label={Strings.common.finish}
						disabled={!allRated}
						loading={submit.isPending}
						onPress={() => submit.mutate()}
					/>
				</>
			}
		>
			<ScaleLegend low={copy.low} high={copy.high} />

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
