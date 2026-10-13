/** Ordered onboarding routes, driving both the progress indicator and step-to-step navigation. */
export const OnboardingSteps = ["basics", "bio", "interests", "partner", "self", "privacy"] as const;

export type OnboardingStep = (typeof OnboardingSteps)[number];

export const ONBOARDING_STEP_COUNT = OnboardingSteps.length;

export function onboardingStepNumber(step: OnboardingStep): number {
	return OnboardingSteps.indexOf(step) + 1;
}

export type OnboardingRoute = `/${OnboardingStep}`;

/** Route for the previous onboarding step; first step goes back to register. */
export function previousOnboardingRoute(step: OnboardingStep): "/register" | OnboardingRoute {
	const index = OnboardingSteps.indexOf(step);

	if (index <= 0) {
		return "/register";
	}

	return `/${OnboardingSteps[index - 1]}`;
}

/** Route for the next onboarding step, or null on the last step. */
export function nextOnboardingRoute(step: OnboardingStep): OnboardingRoute | null {
	const index = OnboardingSteps.indexOf(step);

	if (index >= OnboardingSteps.length - 1) {
		return null;
	}

	return `/${OnboardingSteps[index + 1]}`;
}
