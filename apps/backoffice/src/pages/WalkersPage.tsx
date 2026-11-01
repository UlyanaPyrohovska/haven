import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ModeBadge } from "@/components/ModeBadge";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listWalkTargets, type WalkTarget } from "@/lib/api";

export function WalkersPage() {
	const navigate = useNavigate();
	const [targets, setTargets] = useState<WalkTarget[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [profileId, setProfileId] = useState("");

	useEffect(() => {
		listWalkTargets()
			.then((data) => setTargets(data.targets))
			.catch((err) => setError(err instanceof Error ? err.message : "Failed to load walkers"));
	}, []);

	function onOpen(event: FormEvent) {
		event.preventDefault();
		const id = Number.parseInt(profileId, 10);
		if (Number.isFinite(id)) navigate(`/users/${id}/walkers`);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				title="Location walkers"
				description="Synthetic profiles that walk around a user so crossed paths can be tested."
			/>

			<Card>
				<CardHeader>
					<CardTitle>Set up walkers for a user</CardTitle>
					<CardDescription>Open a profile's walker controls by id, or pick one from the Users page.</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="flex max-w-sm gap-2" onSubmit={onOpen}>
						<Input
							aria-label="Profile id"
							inputMode="numeric"
							placeholder="Profile id, e.g. 42"
							value={profileId}
							onChange={(e) => setProfileId(e.target.value)}
						/>
						<Button type="submit" disabled={!profileId.trim()}>
							Open
						</Button>
					</form>
				</CardContent>
			</Card>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Walking around</TableHead>
							<TableHead>Pool</TableHead>
							<TableHead className="text-right">Walkers</TableHead>
							<TableHead>Last step</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{targets === null && !error ? (
							<TableRow>
								<TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
									Loading…
								</TableCell>
							</TableRow>
						) : null}
						{targets?.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
									No walkers assigned yet.
								</TableCell>
							</TableRow>
						) : null}
						{targets?.map((target) => (
							<TableRow
								key={target.targetId}
								className="cursor-pointer"
								onClick={() => navigate(`/users/${target.targetId}/walkers`)}
							>
								<TableCell>
									<Link to={`/users/${target.targetId}/walkers`} className="font-medium hover:underline">
										{target.name}
									</Link>{" "}
									<span className="text-muted-foreground">#{target.targetId}</span>
									{target.isSynthetic ? null : (
										<Badge variant="outline" className="ml-2">
											Real
										</Badge>
									)}
								</TableCell>
								<TableCell>
									<ModeBadge lookingFor={target.lookingFor} />
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{target.active} active
									{target.walkers > target.active ? (
										<span className="text-muted-foreground"> / {target.walkers - target.active} paused</span>
									) : null}
								</TableCell>
								<TableCell className="whitespace-nowrap text-muted-foreground">
									{target.lastStepAt ? new Date(target.lastStepAt).toLocaleString() : "never"}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
