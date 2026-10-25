import { Badge } from "@/components/ui/badge";

/** Friends (teal) vs dating (rose) — same accents as the mobile app's modes. */
export function ModeBadge({ lookingFor }: { lookingFor: unknown }) {
	if (lookingFor === 1) {
		return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">♥ Dating</Badge>;
	}

	if (lookingFor === 0) {
		return <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">Friends</Badge>;
	}

	return <Badge variant="outline">—</Badge>;
}
