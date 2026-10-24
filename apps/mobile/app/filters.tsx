import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { PartnerFilters } from "@/components/profile/partner-filters";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import type { Range } from "@/components/ui/range-slider";
import type { GenderValue } from "@/constants/profile-taxonomy";
import { profileQueryKey, useProfileQuery } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { buildPartnerFiltersPayload, saveProfileSettings } from "@/lib/api/profile";
import { recommendationsQueryKey } from "@/lib/api/recommendations";
import { readAgeRange, readInterestedIn } from "@/lib/profile/draft-from-record";

type Filters = { interestedIn: GenderValue[]; ageRange: Range };

/** "Who you see": the hard partner filters, opened from the home filter button. */
export default function FiltersScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const profile = useProfileQuery(true);
	const saved = useMemo<Filters | null>(
		() =>
			profile.data
				? { interestedIn: readInterestedIn(profile.data.interestedIn), ageRange: readAgeRange(profile.data) }
				: null,
		[profile.data],
	);
	const [filters, setFilters] = useState<Filters | null>(null);
	const [showMeError, setShowMeError] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (saved) {
			setFilters((current) => current ?? saved);
		}
	}, [saved]);

	const submit = useMutation({
		// The API drops today's pending people who no longer fit, but never refills the batch.
		mutationFn: (next: Filters) => saveProfileSettings(buildPartnerFiltersPayload(next.interestedIn, next.ageRange)),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: profileQueryKey }),
				queryClient.invalidateQueries({ queryKey: recommendationsQueryKey }),
			]);
			router.back();
		},
	});

	if (!filters || !saved) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<ActivityIndicator color={theme.tint} />
			</View>
		);
	}

	const changed =
		JSON.stringify(buildPartnerFiltersPayload(filters.interestedIn, filters.ageRange)) !==
		JSON.stringify(buildPartnerFiltersPayload(saved.interestedIn, saved.ageRange));

	const onSave = () => {
		if (filters.interestedIn.length === 0) {
			setShowMeError(t("onboarding.partner.showMeInvalid"));
			return;
		}

		if (!changed) {
			router.back();
			return;
		}

		submit.mutate(filters);
	};

	return (
		<FormScreen
			title={t("onboarding.partner.filtersTitle")}
			subtitle={`${t("onboarding.partner.filtersHint")} ${t("filters.appliesNote")}`}
			showBack
			onBack={() => router.back()}
			footer={
				<>
					<ErrorBanner message={submit.isError ? t("filters.saveError") : undefined} />
					<Button label={t("filters.save")} loading={submit.isPending} onPress={onSave} />
				</>
			}
		>
			<PartnerFilters
				showHeading={false}
				interestedIn={filters.interestedIn}
				onInterestedInChange={(interestedIn) => {
					setFilters({ ...filters, interestedIn });
					setShowMeError(undefined);
				}}
				ageRange={filters.ageRange}
				onAgeRangeChange={(ageRange) => setFilters({ ...filters, ageRange })}
				error={showMeError}
			/>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});
