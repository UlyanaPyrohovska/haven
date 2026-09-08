import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";

export const defaultLocale = "en" as const;
export type Locale = typeof defaultLocale;

const supportedLocales = [defaultLocale] as const;

function resolveLocale(): Locale {
	const languageCode = Localization.getLocales()[0]?.languageCode;

	if (languageCode && supportedLocales.includes(languageCode as Locale)) {
		return languageCode as Locale;
	}

	return defaultLocale;
}

void i18n.use(initReactI18next).init({
	compatibilityJSON: "v4",
	resources: {
		en: { translation: en },
	},
	lng: resolveLocale(),
	fallbackLng: defaultLocale,
	interpolation: {
		escapeValue: false,
	},
});

export default i18n;
