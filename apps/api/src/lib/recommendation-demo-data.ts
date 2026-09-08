/** Presentation extras for demo recommendation candidates (synthetic profile ids). */
export type DemoCandidatePresentation = {
	displayName: string;
	questionAnswer: string;
	crossPathsCount: number;
};

/** Curated to match the connection-detail mockup and nearby Setúbal profiles. */
export const DEMO_CANDIDATE_PRESENTATION: Record<number, DemoCandidatePresentation> = {
	298: {
		displayName: "Anna",
		questionAnswer: "A small dog from my street",
		crossPathsCount: 3,
	},
	335: {
		displayName: "Maya",
		questionAnswer: "Finding a vinyl record I'd been hunting for months",
		crossPathsCount: 2,
	},
	556: {
		displayName: "Sofia",
		questionAnswer: "Coffee with an old friend on the waterfront",
		crossPathsCount: 4,
	},
	401: {
		displayName: "Leo",
		questionAnswer: "My team finally shipped the feature we'd been grinding on",
		crossPathsCount: 1,
	},
	513: {
		displayName: "Inês",
		questionAnswer: "A stranger helped me carry groceries in the rain",
		crossPathsCount: 2,
	},
};

export const DEMO_CANDIDATE_IDS = Object.keys(DEMO_CANDIDATE_PRESENTATION).map(Number);

export const DEMO_DAILY_QUESTION = "What made you smile this week?";

export function demoPresentation(candidateId: number): DemoCandidatePresentation | undefined {
	return DEMO_CANDIDATE_PRESENTATION[candidateId];
}

export function displayNameForCandidate(candidateId: number, fallback?: string): string {
	return DEMO_CANDIDATE_PRESENTATION[candidateId]?.displayName ?? fallback ?? `Profile ${candidateId}`;
}
