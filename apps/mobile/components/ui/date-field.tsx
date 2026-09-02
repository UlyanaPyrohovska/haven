import { type RefObject, useRef } from "react";
import { type StyleProp, StyleSheet, TextInput, type TextStyle, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { FontFamily, FontSize, LineHeight, Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import type { DateOfBirthParts } from "@/lib/date-of-birth";

export type DateFieldProps = {
	label: string;
	value: DateOfBirthParts;
	onChange: (value: DateOfBirthParts) => void;
	error?: string;
	/** Helper copy shown under the inputs while there is no error. */
	hint?: string;
	dayLabel: string;
	monthLabel: string;
	yearLabel: string;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * Three-part date entry (day / month / year) rather than a native picker, so the flow works
 * identically on every platform and a birth year decades back takes no scrolling.
 */
export function DateField({ label, value, onChange, error, hint, dayLabel, monthLabel, yearLabel }: DateFieldProps) {
	const theme = useTheme();
	const monthRef = useRef<TextInput>(null);
	const yearRef = useRef<TextInput>(null);
	const dayRef = useRef<TextInput>(null);

	const borderColor = error ? theme.danger : "transparent";

	const setDay = (raw: string) => {
		const day = digitsOnly(raw).slice(0, 2);
		onChange({ ...value, day });

		if (day.length === 2) {
			monthRef.current?.focus();
		}
	};

	const setMonth = (raw: string) => {
		const month = digitsOnly(raw).slice(0, 2);
		onChange({ ...value, month });

		if (month.length === 2) {
			yearRef.current?.focus();
		}
	};

	const setYear = (raw: string) => {
		onChange({ ...value, year: digitsOnly(raw).slice(0, 4) });
	};

	return (
		<View style={styles.root}>
			<ThemedText type="label">{label}</ThemedText>

			<View style={styles.row}>
				<Segment
					inputRef={dayRef}
					accessibilityLabel={dayLabel}
					placeholder="DD"
					value={value.day}
					onChangeText={setDay}
					maxLength={2}
					borderColor={borderColor}
				/>
				<Segment
					inputRef={monthRef}
					accessibilityLabel={monthLabel}
					placeholder="MM"
					value={value.month}
					onChangeText={setMonth}
					maxLength={2}
					borderColor={borderColor}
					// Backspacing out of an empty field returns to the previous one.
					onEmptyBackspace={() => dayRef.current?.focus()}
				/>
				<Segment
					inputRef={yearRef}
					accessibilityLabel={yearLabel}
					placeholder="YYYY"
					value={value.year}
					onChangeText={setYear}
					maxLength={4}
					borderColor={borderColor}
					style={styles.yearSegment}
					onEmptyBackspace={() => monthRef.current?.focus()}
				/>
			</View>

			{error ? (
				<ThemedText type="caption" style={{ color: theme.danger }}>
					{error}
				</ThemedText>
			) : hint ? (
				<ThemedText type="caption" style={{ color: theme.muted }}>
					{hint}
				</ThemedText>
			) : null}
		</View>
	);
}

type SegmentProps = {
	inputRef: RefObject<TextInput | null>;
	accessibilityLabel: string;
	placeholder: string;
	value: string;
	onChangeText: (value: string) => void;
	maxLength: number;
	borderColor: string;
	style?: StyleProp<TextStyle>;
	onEmptyBackspace?: () => void;
};

function Segment({
	inputRef,
	accessibilityLabel,
	placeholder,
	value,
	onChangeText,
	maxLength,
	borderColor,
	style,
	onEmptyBackspace,
}: SegmentProps) {
	const theme = useTheme();

	return (
		<TextInput
			ref={inputRef}
			accessibilityLabel={accessibilityLabel}
			placeholder={placeholder}
			placeholderTextColor={theme.placeholder}
			selectionColor={theme.tint}
			keyboardType="number-pad"
			value={value}
			maxLength={maxLength}
			onChangeText={onChangeText}
			onKeyPress={({ nativeEvent }) => {
				if (nativeEvent.key === "Backspace" && value.length === 0) {
					onEmptyBackspace?.();
				}
			}}
			style={[styles.segment, { backgroundColor: theme.field, color: theme.text, borderColor }, style]}
		/>
	);
}

const styles = StyleSheet.create({
	root: {
		gap: Spacing.sm,
	},
	row: {
		flexDirection: "row",
		gap: Spacing.sm,
	},
	segment: {
		flex: 1,
		minHeight: 52,
		borderRadius: Radius.md,
		borderWidth: 1.5,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		fontSize: FontSize.md,
		lineHeight: LineHeight.md,
		fontFamily: FontFamily.body,
		textAlign: "center",
	},
	yearSegment: {
		flex: 1.4,
	},
});
