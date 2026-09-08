import { useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { DateField } from "@/components/ui/date-field";
import { Dialog } from "@/components/ui/dialog";
import { FormScreen } from "@/components/ui/form-screen";
import { IntentPicker } from "@/components/ui/intent-picker";
import { TextField } from "@/components/ui/text-field";
import {
	EthnicityOptions,
	type EthnicityValue,
	GenderOptions,
	type GenderValue,
	type GoalValue,
	goalOptionsForLookingFor,
	isGoalValidForLookingFor,
	LookingForOptions,
	type LookingForValue,
} from "@/constants/profile-taxonomy";
import { Strings } from "@/constants/strings";
import {
	type DateOfBirthParts,
	type DateOfBirthResult,
	evaluateDateOfBirth,
	MIN_AGE,
	splitIsoDate,
} from "@/lib/date-of-birth";
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";

const copy = Strings.onboarding.basics;

function dateOfBirthMessage(status: DateOfBirthResult["status"]): string | undefined {
	switch (status) {
		case "incomplete":
			return copy.dobIncomplete;
		case "invalid":
			return copy.dobInvalid;
		case "unrealistic":
			return copy.dobUnrealistic;
		default:
			return undefined;
	}
}

export default function BasicsStep() {
	const router = useRouter();
	const { draft, updateDraft } = useProfileDraft();

	const [dateOfBirth, setDateOfBirth] = useState<DateOfBirthParts>(() => splitIsoDate(draft.birthDate));
	const [errors, setErrors] = useState<{
		dateOfBirth?: string;
		gender?: string;
		ethnicity?: string;
		lookingFor?: string;
		goal?: string;
	}>({});
	const [underageVisible, setUnderageVisible] = useState(false);

	const goalOptions = useMemo(
		() => (draft.lookingFor === undefined ? [] : goalOptionsForLookingFor(draft.lookingFor)),
		[draft.lookingFor],
	);

	const onContinue = () => {
		const result = evaluateDateOfBirth(dateOfBirth);

		if (result.status === "underage") {
			// Clear any stale value so an under-18 date is never carried into the payload.
			updateDraft({ birthDate: undefined });
			setErrors((current) => ({ ...current, dateOfBirth: undefined }));
			setUnderageVisible(true);
			return;
		}

		const nextErrors = {
			dateOfBirth: dateOfBirthMessage(result.status),
			gender: draft.gender === undefined ? copy.genderInvalid : undefined,
			ethnicity: draft.ethnicity === undefined ? copy.ethnicityInvalid : undefined,
			lookingFor: draft.lookingFor === undefined ? copy.intentInvalid : undefined,
			goal: draft.goal === undefined ? copy.goalInvalid : undefined,
		};
		setErrors(nextErrors);

		if (result.status !== "valid" || Object.values(nextErrors).some(Boolean)) {
			return;
		}

		updateDraft({ birthDate: result.isoDate });
		const next = nextOnboardingRoute("basics");

		if (next) {
			router.replace(next);
		}
	};

	const onLookingForChange = (lookingFor: LookingForValue) => {
		const goal =
			draft.goal && isGoalValidForLookingFor(draft.goal, lookingFor) ? draft.goal : undefined;

		updateDraft({ lookingFor, goal });
		setErrors((current) => ({ ...current, lookingFor: undefined, goal: undefined }));
	};

	return (
		<>
			<FormScreen
				title={copy.title}
				subtitle={copy.subtitle}
				showBack
				onBack={() => router.replace(previousOnboardingRoute("basics"))}
				progress={{ current: onboardingStepNumber("basics"), total: ONBOARDING_STEP_COUNT }}
				footer={<Button label={Strings.common.continue} onPress={onContinue} />}
			>
				<DateField
					label={copy.dobLabel}
					dayLabel={copy.dobDayLabel}
					monthLabel={copy.dobMonthLabel}
					yearLabel={copy.dobYearLabel}
					value={dateOfBirth}
					onChange={(value) => {
						setDateOfBirth(value);
						setErrors((current) => ({ ...current, dateOfBirth: undefined }));
					}}
					error={errors.dateOfBirth}
					hint={copy.dobHint}
				/>

				<ChipGroup<GenderValue>
					label={copy.genderLabel}
					options={GenderOptions}
					value={draft.gender}
					onChange={(gender) => updateDraft({ gender })}
					error={errors.gender}
				/>

				<ChipGroup<EthnicityValue>
					label={copy.ethnicityLabel}
					options={EthnicityOptions}
					value={draft.ethnicity}
					onChange={(ethnicity) => updateDraft({ ethnicity })}
					error={errors.ethnicity}
				/>

				<IntentPicker
					label={copy.intentLabel}
					hint={copy.intentHint}
					options={LookingForOptions}
					value={draft.lookingFor}
					onChange={onLookingForChange}
					error={errors.lookingFor}
				/>

				{draft.lookingFor !== undefined ? (
					<ChipGroup<GoalValue>
						label={copy.goalLabel}
						options={goalOptions}
						value={draft.goal}
						onChange={(goal) => {
							updateDraft({ goal });
							setErrors((current) => ({ ...current, goal: undefined }));
						}}
						error={errors.goal}
					/>
				) : null}

				<TextField
					label={copy.careerLabel}
					placeholder={copy.careerPlaceholder}
					hint={Strings.common.optional}
					value={draft.career}
					onChangeText={(career) => updateDraft({ career })}
					maxLength={100}
				/>
			</FormScreen>

			<Dialog
				visible={underageVisible}
				icon="hourglass-outline"
				tone="danger"
				title={copy.underage.title(MIN_AGE)}
				message={copy.underage.message(MIN_AGE)}
				confirmLabel={copy.underage.dismiss}
				onConfirm={() => setUnderageVisible(false)}
			/>
		</>
	);
}
