import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ChipGroup, MultiChipGroup } from "@/components/ui/chip-group";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { IntentPicker } from "@/components/ui/intent-picker";
import { ScaleLegend } from "@/components/ui/scale-legend";
import { SliderScale } from "@/components/ui/slider-scale";
import { TextField } from "@/components/ui/text-field";
import {
	BIO_MAX_LENGTH,
	EthnicityOptions,
	type EthnicityValue,
	GenderOptions,
	type GenderValue,
	type GoalValue,
	goalOptionsForLookingFor,
	InterestCategories,
	type InterestKey,
	isGoalValidForLookingFor,
	LookingForOptions,
	type LookingForValue,
	MIN_SELECTED_INTERESTS,
	type PrefKey,
	SelfDimensions,
	type SelfKey,
	TraitDimensions,
} from "@/constants/profile-taxonomy";
import { Strings } from "@/constants/strings";
import { profileQueryKey, useProfileQuery } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { saveProfile } from "@/lib/api/profile";
import { profileRecordToDraft } from "@/lib/profile-draft-from-record";
import type { ProfileDraft } from "@/lib/onboarding/profile-draft";

const copy = Strings.profile.editScreen;
const basicsCopy = Strings.onboarding.basics;
const bioCopy = Strings.onboarding.bio;
const interestsCopy = Strings.onboarding.interests;
const partnerCopy = Strings.onboarding.partner;
const selfCopy = Strings.onboarding.self;

const BIO_MIN_LENGTH = 20;

const interestCategories = InterestCategories.map((category) => ({
	key: category.key,
	label: category.label,
	options: category.interests.map((interest) => ({ value: interest.key, label: interest.label })),
}));

export default function ProfileEditScreen() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const theme = useTheme();
	const profile = useProfileQuery(true);
	const initialDraft = useMemo(
		() => (profile.data ? profileRecordToDraft(profile.data) : null),
		[profile.data],
	);
	const [draft, setDraft] = useState<ProfileDraft | null>(null);
	const [errors, setErrors] = useState<{ bio?: string; interests?: string }>({});

	const goalOptions = useMemo(
		() => (draft?.lookingFor === undefined ? [] : goalOptionsForLookingFor(draft.lookingFor)),
		[draft?.lookingFor],
	);

	useEffect(() => {
		if (initialDraft) {
			setDraft(initialDraft);
		}
	}, [initialDraft]);

	const submit = useMutation({
		mutationFn: () => {
			if (!draft) {
				throw new Error("Missing profile draft");
			}

			return saveProfile(draft);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: profileQueryKey });
			router.back();
		},
	});

	if (profile.isPending || !draft) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<ActivityIndicator color={theme.tint} />
			</View>
		);
	}

	const updateDraft = (partial: Partial<ProfileDraft>) => {
		setDraft((current) => (current ? { ...current, ...partial } : current));
	};

	const onLookingForChange = (lookingFor: LookingForValue) => {
		setDraft((current) => {
			if (!current) {
				return current;
			}

			const goal =
				current.goal && isGoalValidForLookingFor(current.goal, lookingFor) ? current.goal : undefined;

			return { ...current, lookingFor, goal };
		});
	};

	const toggleInterest = (key: InterestKey) => {
		setDraft((current) => {
			if (!current) {
				return current;
			}

			const interests = current.interests.includes(key)
				? current.interests.filter((interest) => interest !== key)
				: [...current.interests, key];

			return { ...current, interests };
		});
	};

	const setPartnerImportance = (key: PrefKey, value: number) => {
		setDraft((current) =>
			current ? { ...current, partner: { ...current.partner, [key]: value } } : current,
		);
	};

	const setSelfRating = (key: SelfKey, value: number) => {
		setDraft((current) => (current ? { ...current, self: { ...current.self, [key]: value } } : current));
	};

	const onSave = () => {
		const nextErrors = {
			bio: draft.bio.trim().length < BIO_MIN_LENGTH ? bioCopy.tooShort : undefined,
			interests:
				draft.interests.length < MIN_SELECTED_INTERESTS
					? interestsCopy.tooFew(MIN_SELECTED_INTERESTS)
					: undefined,
		};

		setErrors(nextErrors);

		if (Object.values(nextErrors).some(Boolean)) {
			return;
		}

		submit.mutate();
	};

	const partnerComplete = TraitDimensions.every(
		(dimension) => draft.partner[dimension.prefKey] !== undefined,
	);
	const selfComplete = SelfDimensions.every((dimension) => draft.self[dimension.selfKey] !== undefined);

	return (
		<FormScreen
			title={copy.title}
			subtitle={copy.subtitle}
			showBack
			footer={
				<>
					<ErrorBanner message={submit.isError ? Strings.profile.editScreen.saveError : undefined} />
					<Button
						label={copy.save}
						loading={submit.isPending}
						disabled={!partnerComplete || !selfComplete}
						onPress={onSave}
					/>
				</>
			}
		>
			<ChipGroup<GenderValue>
				label={basicsCopy.genderLabel}
				options={GenderOptions}
				value={draft.gender}
				onChange={(gender) => updateDraft({ gender })}
			/>

			<ChipGroup<EthnicityValue>
				label={basicsCopy.ethnicityLabel}
				options={EthnicityOptions}
				value={draft.ethnicity}
				onChange={(ethnicity) => updateDraft({ ethnicity })}
			/>

			<IntentPicker
				label={basicsCopy.intentLabel}
				hint={basicsCopy.intentHint}
				options={LookingForOptions}
				value={draft.lookingFor}
				onChange={onLookingForChange}
			/>

			{draft.lookingFor !== undefined ? (
				<ChipGroup<GoalValue>
					label={basicsCopy.goalLabel}
					options={goalOptions}
					value={draft.goal}
					onChange={(goal) => updateDraft({ goal })}
				/>
			) : null}

			<TextField
				label={basicsCopy.careerLabel}
				placeholder={basicsCopy.careerPlaceholder}
				hint={Strings.common.optional}
				value={draft.career}
				onChangeText={(career) => updateDraft({ career })}
				maxLength={100}
			/>

			<TextField
				label={bioCopy.label}
				placeholder={bioCopy.placeholder}
				value={draft.bio}
				onChangeText={(bio) => {
					updateDraft({ bio });
					setErrors((current) => ({ ...current, bio: undefined }));
				}}
				error={errors.bio}
				maxLength={BIO_MAX_LENGTH}
				showCounter
				multiline
			/>

			<ThemedText type="label">{interestsCopy.title}</ThemedText>
			<ThemedText type="caption" style={{ color: theme.muted }}>
				{interestsCopy.selected(draft.interests.length)}
			</ThemedText>
			{errors.interests ? (
				<ThemedText type="caption" style={{ color: theme.danger }}>
					{errors.interests}
				</ThemedText>
			) : null}

			{interestCategories.map((category) => (
				<MultiChipGroup<InterestKey>
					key={category.key}
					label={category.label}
					options={category.options}
					values={draft.interests}
					onToggle={toggleInterest}
				/>
			))}

			<ThemedText type="label">{partnerCopy.title}</ThemedText>
			<ScaleLegend low={partnerCopy.low} high={partnerCopy.high} />
			{TraitDimensions.map((dimension) => (
				<SliderScale
					key={dimension.prefKey}
					label={dimension.label}
					value={draft.partner[dimension.prefKey]}
					onChange={(value) => setPartnerImportance(dimension.prefKey, value)}
				/>
			))}

			<ThemedText type="label">{selfCopy.title}</ThemedText>
			<ScaleLegend low={selfCopy.low} high={selfCopy.high} />
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

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});
