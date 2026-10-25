import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUserRecommendations, regenerateUserRecommendations, type StaffRecommendations } from "@/lib/api";

function score(value: number | null) {
	return value === null ? "—" : value.toFixed(3);
}

const COMPONENT_COLUMNS = [
	{ key: "bio", label: "Bio" },
	{ key: "interest", label: "Interest" },
	{ key: "geo", label: "Geo" },
	{ key: "prefUToV", label: "Pref u→v" },
	{ key: "prefVToU", label: "Pref v→u" },
	{ key: "pUToV", label: "p u→v" },
	{ key: "qVToU", label: "q v→u" },
	{ key: "reciprocal", label: "Reciprocal" },
] as const;

export function RecommendationScores({ profileId }: { profileId: number }) {
	const [data, setData] = useState<StaffRecommendations | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [regenerating, setRegenerating] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setData(null);
		setError(null);

		getUserRecommendations(profileId)
			.then((result) => {
				if (!cancelled) setData(result);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load recommendations");
			});

		return () => {
			cancelled = true;
		};
	}, [profileId]);

	async function onRegenerate() {
		if (
			!window.confirm(
				"Replace this user's pending recommendations with a fresh batch? This also resets their feed cooldown.",
			)
		) {
			return;
		}

		setRegenerating(true);
		setError(null);
		try {
			setData(await regenerateUserRecommendations(profileId));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to regenerate recommendations");
		} finally {
			setRegenerating(false);
		}
	}

	const weights = data?.weights;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recommendation scores</CardTitle>
				<CardDescription>
					Every candidate shown to this user. Stored is the score saved when the batch was generated; the other columns
					are recomputed from current profiles
					{weights
						? ` (weights bio ${weights.bio}, interest ${weights.interest}, geo ${weights.geo}, pref ${weights.pref}; bio dropped and the rest renormalized when missing)`
						: null}
					. Score = reciprocal × cross-paths boost.
				</CardDescription>
				<CardAction>
					<Button type="button" variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating || !data}>
						{regenerating ? "Regenerating…" : "Regenerate"}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{error ? (
					<Alert variant="destructive" className="mb-4">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				{!data ? (
					error ? null : (
						<p className="text-sm text-muted-foreground">Loading…</p>
					)
				) : data.recommendations.length === 0 ? (
					<p className="text-sm text-muted-foreground">No recommendations yet.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Rank</TableHead>
								<TableHead>Candidate</TableHead>
								<TableHead>Shown</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Stored</TableHead>
								{COMPONENT_COLUMNS.map((column) => (
									<TableHead key={column.key} className="text-right">
										{column.label}
									</TableHead>
								))}
								<TableHead className="text-right">Crossings</TableHead>
								<TableHead className="text-right">Score</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.recommendations.map((row) => (
								<TableRow key={row.candidateId}>
									<TableCell className="tabular-nums">{row.rank ?? "—"}</TableCell>
									<TableCell>
										<Link to={`/users/${row.candidateId}`} className="font-medium hover:underline">
											{row.name}
										</Link>{" "}
										<span className="text-muted-foreground">#{row.candidateId}</span>
										{row.isSynthetic ? (
											<Badge variant="secondary" className="ml-2">
												Synthetic
											</Badge>
										) : null}
									</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground">
										{new Date(row.shownAt).toLocaleString()}
									</TableCell>
									<TableCell>
										<Badge variant={row.actedOn ? "outline" : "secondary"}>
											{row.actedOn ? "Acted on" : "Pending"}
										</Badge>
									</TableCell>
									<TableCell className="text-right tabular-nums">{score(row.storedScore)}</TableCell>
									{COMPONENT_COLUMNS.map((column) => (
										<TableCell key={column.key} className="text-right tabular-nums">
											{score(row[column.key])}
										</TableCell>
									))}
									<TableCell className="text-right tabular-nums">{row.crossings}</TableCell>
									<TableCell className="text-right font-medium tabular-nums">{score(row.score)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
