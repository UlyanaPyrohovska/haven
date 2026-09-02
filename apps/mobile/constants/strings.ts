/**
 * Default locale. Add more keys to `translations` as locales are supported.
 */
export const defaultLocale = "en" as const;

export type Locale = keyof typeof translations;

const en = {
	app: {
		name: "Haven",
		tagline: "Connect without limits",
	},
	home: {
		title: "Haven",
		greeting: (name: string) => `Hello ${name}`,
		newConnections: "New Connections",
		moodPrompt: "What is your mood today?",
		todaysQuestion: "Today's Question",
		responsePlaceholder: "Write your response...",
	},
	common: {
		back: "Back",
		continue: "Continue",
		finish: "Finish",
		optional: "Optional",
		retry: "Try again",
		signOut: "Sign out",
		skip: "Skip for now",
	},
	auth: {
		login: {
			title: "Welcome back",
			submit: "Sign in",
			footerPrompt: "New to Haven?",
			footerAction: "Create an account",
		},
		register: {
			title: "Create your account",
			subtitle: "A few details to get started, then we'll set up your preferences.",
			submit: "Continue",
			footerPrompt: "Already have an account?",
			footerAction: "Sign in",
		},
		fields: {
			name: "Name",
			namePlaceholder: "How should we call you?",
			email: "Email",
			emailPlaceholder: "you@example.com",
			password: "Password",
			passwordPlaceholder: "At least 8 characters",
			confirmPassword: "Confirm password",
			confirmPasswordPlaceholder: "Repeat your password",
			enterPassword: "Enter your password",
			showPassword: "Show password",
			hidePassword: "Hide password",
		},
		validation: {
			nameRequired: "Please enter your name.",
			emailRequired: "Please enter your email.",
			emailInvalid: "That doesn't look like a valid email.",
			passwordRequired: "Please enter a password.",
			passwordTooShort: "Use at least 8 characters.",
			confirmPasswordMismatch: "Passwords don't match.",
		},
		errors: {
			invalidCredentials: "Wrong email or password.",
			emailTaken: "An account already exists for that email.",
			network: "Can't reach Haven right now. Check your connection.",
			generic: "Something went wrong. Please try again.",
		},
	},
	onboarding: {
		stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
		basics: {
			title: "About you",
			subtitle: "This helps us find people you'll actually get along with.",
			dobLabel: "Date of birth",
			dobDayLabel: "Day",
			dobMonthLabel: "Month",
			dobYearLabel: "Year",
			dobHint: "We only use this to confirm you're old enough to join.",
			dobIncomplete: "Please enter your full date of birth.",
			dobInvalid: "That isn't a real date.",
			dobUnrealistic: "Please check the year you entered.",
			underage: {
				title: (minAge: number) => `You need to be ${minAge}`,
				message: (minAge: number) =>
					`Haven is only open to people aged ${minAge} and over, so we can't set up a profile for you yet.`,
				dismiss: "I understand",
			},
			genderLabel: "Gender",
			genderInvalid: "Please pick one.",
			careerLabel: "What do you do?",
			careerPlaceholder: "Designer, student, nurse…",
			goalLabel: "What are you looking for?",
			goalInvalid: "Please pick one.",
		},
		bio: {
			title: "Introduce yourself",
			subtitle: "A couple of sentences in your own words. This is what people read first.",
			label: "About me",
			placeholder: "I quit my job to open a bakery…",
			tooShort: "Write at least 20 characters so people get a sense of you.",
		},
		interests: {
			title: "Your interests",
			subtitle: "Tap everything you're into. This is what we match you on, so pick freely.",
			selected: (count: number) => `${count} selected`,
			tooFew: (count: number) => `Pick at least ${count} interests to continue.`,
		},
		partner: {
			title: "What matters in others",
			subtitle: "Drag each slider to show how much it matters to you. We balance the weightings for you.",
			low: "Doesn't matter",
			high: "Matters most",
			incomplete: "Set every slider to continue.",
		},
		self: {
			title: "How you see yourself",
			subtitle: "Drag each slider to rate yourself. Nobody else sees these numbers.",
			low: "Not really me",
			high: "Very much me",
		},
		submit: {
			error: "We couldn't save your preferences. Please try again.",
		},
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
