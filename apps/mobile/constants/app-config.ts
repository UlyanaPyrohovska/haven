import { Platform, type TextStyle } from "react-native";

export const Colors = {
	brand: {
		ink: "#484848",
		splash: "#dcdcdc",
		white: "#ffffff",
	},
	palette: {
		forest: "#222725",
		night: "#121113",
		terracotta: "#A44A3F",
		/** Primary warm accent — buttons, selected chips, progress, links. */
		honey: "#E89217",
		honeyLight: "#F5B942",
		honeyDeep: "#C87A0E",
		honeySoft: "#FFF4E5",
	},
	light: {
		text: "#484848",
		background: "#FFFCF8",
		surface: "#FFF7ED",
		tint: "#E89217",
		icon: "#687076",
		tabIconDefault: "#687076",
		tabIconSelected: "#E89217",
		link: "#C87A0E",
		muted: "#8a8a8a",
		border: "#F0E4D4",
		field: "#FFF0E0",
		placeholder: "#a8a8a8",
		onTint: "#ffffff",
		danger: "#A44A3F",
		track: "#F0E4D4",
		scrim: "rgba(30, 30, 30, 0.4)",
		/** Soft warm fill for badges, avatars, and highlight cards. */
		accentSoft: "#FFF4E5",
	},
	dark: {
		text: "#ECEDEE",
		background: "#151718",
		surface: "#1F1C18",
		tint: "#F5B942",
		icon: "#9BA1A6",
		tabIconDefault: "#9BA1A6",
		tabIconSelected: "#F5B942",
		link: "#F5B942",
		muted: "#9BA1A6",
		border: "#3A3428",
		field: "#252018",
		placeholder: "#6b7276",
		onTint: "#1A1206",
		danger: "#d3796c",
		track: "#3A3428",
		scrim: "rgba(0, 0, 0, 0.6)",
		accentSoft: "#2E2618",
	},
} as const;

export type ColorScheme = "light" | "dark";

export type ThemeColorName = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
} as const;

export const Radius = {
	sm: 8,
	md: 12,
	lg: 20,
	pill: 999,
} as const;

export const FontFamily = {
	brand: "Kodchasan",
	body: Platform.select({
		ios: "System",
		android: "sans-serif",
		default: "System",
		web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	}),
	mono: Platform.select({
		ios: "Menlo",
		android: "monospace",
		default: "monospace",
		web: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
	}),
} as const;

export const FontSize = {
	xs: 12,
	sm: 14,
	md: 16,
	lg: 20,
	xl: 32,
	/** In-app brand wordmark; smaller than the splash treatment. */
	wordmark: 36,
	brand: 52,
} as const;

export const LineHeight = {
	sm: 20,
	md: 24,
	lg: 28,
	xl: 32,
} as const;

export const FontWeight = {
	regular: "400",
	medium: "500",
	semibold: "600",
	bold: "700",
} as const;

export const TextStyles = {
	body: {
		fontSize: FontSize.md,
		lineHeight: LineHeight.md,
		fontFamily: FontFamily.body,
	} satisfies TextStyle,
	bodySemiBold: {
		fontSize: FontSize.md,
		lineHeight: LineHeight.md,
		fontWeight: FontWeight.semibold,
		fontFamily: FontFamily.body,
	} satisfies TextStyle,
	title: {
		fontSize: FontSize.xl,
		lineHeight: LineHeight.xl,
		fontWeight: FontWeight.bold,
		fontFamily: FontFamily.body,
	} satisfies TextStyle,
	subtitle: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.bold,
		fontFamily: FontFamily.body,
	} satisfies TextStyle,
	/** Field and section labels sitting above their control. */
	label: {
		fontSize: FontSize.sm,
		lineHeight: LineHeight.sm,
		fontWeight: FontWeight.medium,
		fontFamily: FontFamily.body,
	} satisfies TextStyle,
	/** Helper text, validation messages, step counters. */
	caption: {
		fontSize: FontSize.xs,
		lineHeight: LineHeight.sm,
		fontFamily: FontFamily.body,
	} satisfies TextStyle,
	link: {
		fontSize: FontSize.md,
		lineHeight: LineHeight.lg,
		fontFamily: FontFamily.body,
	} satisfies TextStyle,
	brand: {
		fontSize: FontSize.brand,
		fontWeight: FontWeight.medium,
		fontFamily: FontFamily.brand,
	} satisfies TextStyle,
	/** Brand wordmark inside the app, e.g. above the auth forms. */
	wordmark: {
		fontSize: FontSize.wordmark,
		fontWeight: FontWeight.medium,
		fontFamily: FontFamily.brand,
	} satisfies TextStyle,
} as const;

export type TextStyleName = keyof typeof TextStyles;
