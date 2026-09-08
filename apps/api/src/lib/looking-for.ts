/** Primary matching mode: friends and dating pools never cross. */
export const LookingFor = {
	friends: 0,
	dating: 1,
} as const;

export type LookingForValue = (typeof LookingFor)[keyof typeof LookingFor];

/** Exact `goal` strings from the synthetic dataset. */
export const FriendsGoals = [
	"To meet new people",
	"Seemed like fun",
	"To say I did it",
	"Other",
] as const;

export const DatingGoals = ["To get a date", "Looking for a serious relationship"] as const;

export const ProfileGoals = [...FriendsGoals, ...DatingGoals] as const;

export type ProfileGoal = (typeof ProfileGoals)[number];

const datingGoalSet = new Set<string>(DatingGoals);

export function lookingForFromGoal(goal: string): LookingForValue {
	return datingGoalSet.has(goal) ? LookingFor.dating : LookingFor.friends;
}

export function isGoalValidForLookingFor(goal: string, lookingFor: LookingForValue): boolean {
	const allowed = lookingFor === LookingFor.dating ? DatingGoals : FriendsGoals;

	return (allowed as readonly string[]).includes(goal);
}
