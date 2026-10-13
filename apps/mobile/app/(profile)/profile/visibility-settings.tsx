import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ProfilePrivacyControls } from "@/components/profile/profile-privacy-controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { profileQueryKey, useProfileQuery } from "@/hooks/use-profile";
import { saveProfileSettings } from "@/lib/api/profile";
import { type PrivacyKey, readPrivacySettings } from "@/lib/profile/privacy";

export default function VisibilitySettingsScreen() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const profile = useProfileQuery(true);
	const [saveError, setSaveError] = useState<string | null>(null);

	const privacy = readPrivacySettings(profile.data);

	const saveMutation = useMutation({
		mutationFn: saveProfileSettings,
		onMutate: async (updates) => {
			setSaveError(null);
			await queryClient.cancelQueries({ queryKey: profileQueryKey });
			const previous = queryClient.getQueryData(profileQueryKey);
			queryClient.setQueryData(profileQueryKey, (current) =>
				current && typeof current === "object" ? { ...current, ...updates } : current,
			);

			return { previous };
		},
		onSuccess: (updatedProfile) => {
			queryClient.setQueryData(profileQueryKey, updatedProfile);
		},
		onError: (_error, _updates, context) => {
			if (context?.previous !== undefined) {
				queryClient.setQueryData(profileQueryKey, context.previous);
			}

			setSaveError(t("profile.settingsScreen.saveError"));
		},
	});

	const onTogglePrivacy = (key: PrivacyKey, value: boolean) => {
		saveMutation.mutate({ [key]: value });
	};

	const busy = saveMutation.isPending || profile.isPending;
	const disabled = busy || !profile.data;

	return (
		<FormScreen
			title={t("profile.settingsScreen.visibilityScreen.title")}
			subtitle={t("profile.settingsScreen.visibilityScreen.subtitle")}
			showBack
		>
			{saveError ? <ErrorBanner message={saveError} /> : null}

			<ProfilePrivacyControls
				privacy={privacy}
				onToggle={onTogglePrivacy}
				disabled={disabled}
				busy={busy}
			/>
		</FormScreen>
	);
}
