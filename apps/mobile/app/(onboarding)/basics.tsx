import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";
import {
	type DateOfBirthParts,
	type DateOfBirthResult,
	evaluateDateOfBirth,
	MIN_AGE,
	splitIsoDate,
} from "@/lib/utils/date-of-birth";

export default function BasicsStep() {
	const { t } = useTranslation();
	const router = useRouter();
	const { draft, updateDraft } = useProfileDraft();

	const dateOfBirthMessage = (status: DateOfBirthResult["status"]): string | undefined => {
		switch (status) {
			case "incomplete":
				return t("onboarding.basics.dobIncomplete");
			case "invalid":
				return t("onboarding.basics.dobInvalid");
			case "unrealistic":
				return t("onboarding.basics.dobUnrealistic");
			default:
				return undefined;
		}
	};

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
			gender: draft.gender === undefined ? t("onboarding.basics.genderInvalid") : undefined,
			ethnicity: draft.ethnicity === undefined ? t("onboarding.basics.ethnicityInvalid") : undefined,
			lookingFor: draft.lookingFor === undefined ? t("onboarding.basics.intentInvalid") : undefined,
			goal: draft.goal === undefined ? t("onboarding.basics.goalInvalid") : undefined,
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
		const goal = draft.goal && isGoalValidForLookingFor(draft.goal, lookingFor) ? draft.goal : undefined;

		updateDraft({ lookingFor, goal });
		setErrors((current) => ({ ...current, lookingFor: undefined, goal: undefined }));
	};

	return (
		<>
			<FormScreen
				title={t("onboarding.basics.title")}
				subtitle={t("onboarding.basics.subtitle")}
				showBack
				onBack={() => router.replace(previousOnboardingRoute("basics"))}
				progress={{ current: onboardingStepNumber("basics"), total: ONBOARDING_STEP_COUNT }}
				footer={<Button label={t("common.continue")} onPress={onContinue} />}
			>
				<DateField
					label={t("onboarding.basics.dobLabel")}
					dayLabel={t("onboarding.basics.dobDayLabel")}
					monthLabel={t("onboarding.basics.dobMonthLabel")}
					yearLabel={t("onboarding.basics.dobYearLabel")}
					value={dateOfBirth}
					onChange={(value) => {
						setDateOfBirth(value);
						setErrors((current) => ({ ...current, dateOfBirth: undefined }));
					}}
					error={errors.dateOfBirth}
					hint={t("onboarding.basics.dobHint")}
				/>

				<ChipGroup<GenderValue>
					label={t("onboarding.basics.genderLabel")}
					options={GenderOptions}
					value={draft.gender}
					onChange={(gender) => updateDraft({ gender })}
					error={errors.gender}
				/>

				<ChipGroup<EthnicityValue>
					label={t("onboarding.basics.ethnicityLabel")}
					options={EthnicityOptions}
					value={draft.ethnicity}
					onChange={(ethnicity) => updateDraft({ ethnicity })}
					error={errors.ethnicity}
				/>

				<IntentPicker
					label={t("onboarding.basics.intentLabel")}
					hint={t("onboarding.basics.intentHint")}
					options={LookingForOptions}
					value={draft.lookingFor}
					onChange={onLookingForChange}
					error={errors.lookingFor}
				/>

				{draft.lookingFor !== undefined ? (
					<ChipGroup<GoalValue>
						label={t("onboarding.basics.goalLabel")}
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
					label={t("onboarding.basics.careerLabel")}
					placeholder={t("onboarding.basics.careerPlaceholder")}
					hint={t("common.optional")}
					value={draft.career}
					onChangeText={(career) => updateDraft({ career })}
					maxLength={100}
				/>
			</FormScreen>

			<Dialog
				visible={underageVisible}
				icon="hourglass-outline"
				tone="danger"
				title={t("onboarding.basics.underage.title", { minAge: MIN_AGE })}
				message={t("onboarding.basics.underage.message", { minAge: MIN_AGE })}
				confirmLabel={t("onboarding.basics.underage.dismiss")}
				onConfirm={() => setUnderageVisible(false)}
			/>
		</>
	);
}
