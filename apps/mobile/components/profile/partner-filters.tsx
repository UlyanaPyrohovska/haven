import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { MultiChipGroup } from "@/components/ui/chip-group";
import { type Range, RangeSlider } from "@/components/ui/range-slider";
import { Spacing } from "@/constants/app-config";
import { AGE_FILTER_MAX, AGE_FILTER_MIN, type GenderValue, InterestedInOptions } from "@/constants/profile-taxonomy";
import { useTheme } from "@/hooks/use-theme";

export type PartnerFiltersProps = {
	interestedIn: readonly GenderValue[];
	onInterestedInChange: (value: GenderValue[]) => void;
	ageRange: Range;
	onAgeRangeChange: (value: Range) => void;
	error?: string;
	/** Off when the screen title already says "Who you see". */
	showHeading?: boolean;
};

/** Short "Women · 25–35" line for the home filter button; null when nothing is filtered. */
export function partnerFiltersSummary(interestedIn: readonly GenderValue[], ageRange: Range): string | null {
	const genders =
		interestedIn.length === 0 || interestedIn.length === InterestedInOptions.length
			? null
			: InterestedInOptions.filter((option) => interestedIn.includes(option.value))
					.map((option) => option.label)
					.join(", ");
	const ages = ageRange.min <= AGE_FILTER_MIN && ageRange.max >= AGE_FILTER_MAX ? null : formatAgeRange(ageRange);

	return [genders, ages].filter(Boolean).join(" · ") || null;
}

function formatAgeRange({ min, max }: Range): string {
	return max >= AGE_FILTER_MAX ? `${min}–${max}+` : `${min}–${max}`;
}

/** Hard "who you want to meet" filters: gender and age range. Applied both ways by the API. */
export function PartnerFilters({
	interestedIn,
	onInterestedInChange,
	ageRange,
	onAgeRangeChange,
	error,
	showHeading = true,
}: PartnerFiltersProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const toggle = (gender: GenderValue) => {
		onInterestedInChange(
			interestedIn.includes(gender) ? interestedIn.filter((value) => value !== gender) : [...interestedIn, gender],
		);
	};

	return (
		<View style={styles.root}>
			{showHeading ? (
				<View style={styles.heading}>
					<ThemedText type="subtitle">{t("onboarding.partner.filtersTitle")}</ThemedText>
					<ThemedText type="caption" style={{ color: theme.muted }}>
						{t("onboarding.partner.filtersHint")}
					</ThemedText>
				</View>
			) : null}

			{/* Grouped so the error hugs the chips while the age slider gets section spacing. */}
			<View style={styles.group}>
				<MultiChipGroup<GenderValue>
					label={t("onboarding.partner.showMeLabel")}
					options={InterestedInOptions}
					values={interestedIn}
					onToggle={toggle}
				/>
				{error ? (
					<ThemedText type="caption" style={{ color: theme.danger }}>
						{error}
					</ThemedText>
				) : null}
			</View>

			<RangeSlider
				label={t("onboarding.partner.ageLabel")}
				emoji="🎂"
				value={ageRange}
				onChange={onAgeRangeChange}
				min={AGE_FILTER_MIN}
				max={AGE_FILTER_MAX}
				formatValue={formatAgeRange}
				lowLabel={t("onboarding.partner.ageMinA11y")}
				highLabel={t("onboarding.partner.ageMaxA11y")}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		gap: Spacing.xl,
	},
	group: {
		gap: Spacing.sm,
	},
	heading: {
		gap: Spacing.xs,
	},
});
