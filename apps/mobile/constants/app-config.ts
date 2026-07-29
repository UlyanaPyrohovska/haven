import { Platform, type TextStyle } from "react-native";

export const Colors = {
	brand: {
		ink: "#484848",
		splash: "#dcdcdc",
		white: "#ffffff",
	},
	/** Reserved design tokens — not wired into theme yet. */
	palette: {
		forest: "#222725",
		night: "#121113",
		terracotta: "#A44A3F",
	},
	light: {
		text: "#484848",
		background: "#ffffff",
		surface: "#f5f5f5",
		tint: "#484848",
		icon: "#687076",
		tabIconDefault: "#687076",
		tabIconSelected: "#484848",
		link: "#484848",
	},
	dark: {
		text: "#ECEDEE",
		background: "#151718",
		surface: "#1f2122",
		tint: "#dcdcdc",
		icon: "#9BA1A6",
		tabIconDefault: "#9BA1A6",
		tabIconSelected: "#dcdcdc",
		link: "#dcdcdc",
	},
} as const;

export type ColorScheme = "light" | "dark";

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
} as const;

export type TextStyleName = keyof typeof TextStyles;
