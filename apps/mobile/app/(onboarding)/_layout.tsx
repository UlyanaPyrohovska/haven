import { Stack } from "expo-router";

import { ProfileDraftProvider } from "@/lib/onboarding/profile-draft";

export default function OnboardingLayout() {
	return (
		<ProfileDraftProvider>
			<Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
		</ProfileDraftProvider>
	);
}
