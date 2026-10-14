import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { MultiChipGroup } from "@/components/ui/chip-group";
import { TextField } from "@/components/ui/text-field";
import { Spacing } from "@/constants/app-config";
import {
	CUSTOM_INTEREST_MAX_LENGTH,
	createCustomInterest,
	customInterestsQueryKey,
	MAX_CUSTOM_INTERESTS,
	searchCustomInterests,
} from "@/lib/api/custom-interests";

export type CustomInterestPickerProps = {
	values: string[];
	onChange: (values: string[]) => void;
};

/** Picks from interests other people created, or adds a new one to the shared catalog. */
export function CustomInterestPicker({ values, onChange }: CustomInterestPickerProps) {
	const { t } = useTranslation();
	const [text, setText] = useState("");
	const query = useDeferredValue(text.trim());
	const full = values.length >= MAX_CUSTOM_INTERESTS;

	const suggestions = useQuery({
		queryKey: customInterestsQueryKey(query),
		queryFn: () => searchCustomInterests(query),
		staleTime: 60_000,
	});

	const selectedKeys = new Set(values.map((value) => value.toLowerCase()));
	const select = (label: string) => {
		if (!full && !selectedKeys.has(label.toLowerCase())) {
			onChange([...values, label]);
		}
	};

	const add = useMutation({
		mutationFn: createCustomInterest,
		onSuccess: (label) => {
			select(label);
			setText("");
		},
	});

	const submit = () => {
		if (text.trim() && !full) {
			add.mutate(text);
		}
	};

	const options = [
		...values,
		...(suggestions.data ?? []).filter((label) => !selectedKeys.has(label.toLowerCase())),
	].map((label) => ({ value: label, label, emoji: "✨" }));

	return (
		<View style={styles.root}>
			{options.length > 0 ? (
				<MultiChipGroup<string>
					label={t("onboarding.interests.custom.label")}
					options={options}
					values={values}
					onToggle={(label) =>
						selectedKeys.has(label.toLowerCase()) ? onChange(values.filter((value) => value !== label)) : select(label)
					}
				/>
			) : null}

			<TextField
				label={t("onboarding.interests.custom.add")}
				placeholder={t("onboarding.interests.custom.placeholder")}
				value={text}
				onChangeText={(value) => {
					setText(value);
					add.reset();
				}}
				onSubmitEditing={submit}
				returnKeyType="done"
				maxLength={CUSTOM_INTEREST_MAX_LENGTH}
				editable={!full}
				error={add.error?.message}
				hint={full ? t("onboarding.interests.custom.full", { count: MAX_CUSTOM_INTERESTS }) : undefined}
			/>
			<Button
				label={t("onboarding.interests.custom.submit")}
				variant="secondary"
				onPress={submit}
				loading={add.isPending}
				disabled={full || !text.trim()}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		gap: Spacing.md,
	},
});
