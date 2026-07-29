/**
 * Default locale. Add more keys to `translations` as locales are supported.
 */
export const defaultLocale = "en" as const;

export type Locale = keyof typeof translations;

const en = {
	app: {
		name: "Haven",
	},
	home: {
		title: "Haven",
	},
} as const;

export const translations = {
	en,
} as const;

export type TranslationSchema = typeof en;

/** Resolve copy for a locale. Wire device locale here when i18n is added. */
export function getStrings(locale: Locale = defaultLocale): TranslationSchema {
	return translations[locale];
}

/** Current locale strings. Import this until a `useStrings()` hook replaces it. */
export const Strings = getStrings();
