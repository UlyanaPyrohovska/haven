import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
	type AssignWalkersInput,
	assignWalkers,
	getWalkers,
	removeWalker,
	stepWalkers,
	updateWalker,
	type WalkersOverview,
} from "@/lib/api";

/** Re-reads the overview so cron steps show up without reloading. */
const REFRESH_MS = 30_000;
const METERS_PER_DEG_LAT = 111_320;

type LatLon = { latitude: number; longitude: number };

function offsetMeters(origin: LatLon, point: LatLon) {
	return {
		east: (point.longitude - origin.longitude) * METERS_PER_DEG_LAT * Math.cos((origin.latitude * Math.PI) / 180),
		north: (point.latitude - origin.latitude) * METERS_PER_DEG_LAT,
	};
}

function ago(iso: string | null) {
	if (!iso) return "never";
	const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 120) return `${minutes} min ago`;
	return new Date(iso).toLocaleString();
}

function optionalNumber(value: string) {
	return value.trim() === "" ? undefined : Number(value);
}

/** Top-down plot in meters around the target: crossing radius, walk areas and walkers. No map tiles, so no third party. */
function WalkPlot({ data }: { data: WalkersOverview }) {
	const { target, walkers, rules } = data;
	const targetPoint =
		target.latitude != null && target.longitude != null && !target.locationHidden
			? { latitude: target.latitude, longitude: target.longitude }
			: null;
	const origin =
		targetPoint ?? (walkers[0] ? { latitude: walkers[0].centerLat, longitude: walkers[0].centerLon } : null);

	if (!origin) {
		return <p className="text-sm text-muted-foreground">No location to plot yet.</p>;
	}

	const areas = [
		...new Map(walkers.map((w) => [`${w.centerLat},${w.centerLon},${w.radiusM}`, w] as const)).values(),
	].map((w) => ({ ...offsetMeters(origin, { latitude: w.centerLat, longitude: w.centerLon }), radius: w.radiusM }));
	const dots = walkers.flatMap((w) =>
		w.latitude != null && w.longitude != null
			? [{ walker: w, ...offsetMeters(origin, { latitude: w.latitude, longitude: w.longitude }) }]
			: [],
	);
	const extent =
		1.15 *
		Math.max(
			rules.crossingRadiusM,
			...areas.map((a) => Math.hypot(a.east, a.north) + a.radius),
			...dots.map((d) => Math.hypot(d.east, d.north)),
		);
	const size = 360;
	const scale = size / 2 / extent;
	const x = (east: number) => size / 2 + east * scale;
	const y = (north: number) => size / 2 - north * scale;

	return (
		<figure className="space-y-2">
			<svg
				viewBox={`0 0 ${size} ${size}`}
				className="w-full max-w-[360px] rounded-lg border bg-muted/30"
				role="img"
				aria-label="Walker positions around the target"
			>
				{areas.map((a) => (
					<circle
						key={`${a.east},${a.north},${a.radius}`}
						cx={x(a.east)}
						cy={y(a.north)}
						r={a.radius * scale}
						className="fill-primary/5 stroke-primary/30"
					/>
				))}
				{targetPoint ? (
					<>
						<circle
							cx={x(0)}
							cy={y(0)}
							r={rules.crossingRadiusM * scale}
							className="fill-none stroke-destructive/60"
							strokeDasharray="4 4"
						/>
						<circle cx={x(0)} cy={y(0)} r={6} className="fill-destructive" />
						<text x={x(0) + 9} y={y(0) + 4} className="fill-foreground text-[11px] font-medium">
							{target.name}
						</text>
					</>
				) : null}
				{dots.map((d) => (
					<g key={d.walker.walkerId} opacity={d.walker.active ? 1 : 0.4}>
						<circle cx={x(d.east)} cy={y(d.north)} r={4.5} className="fill-primary" />
						<text x={x(d.east) + 7} y={y(d.north) + 4} className="fill-muted-foreground text-[10px]">
							#{d.walker.walkerId}
						</text>
					</g>
				))}
			</svg>
			<figcaption className="text-xs text-muted-foreground">
				Red dot: target; dashed: {rules.crossingRadiusM} m crossing radius; shaded: walk areas. Plot width ≈{" "}
				{Math.round(extent * 2)} m, north up.
			</figcaption>
		</figure>
	);
}

export function LocationWalkers({ profileId }: { profileId: number }) {
	const [data, setData] = useState<WalkersOverview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [markPresent, setMarkPresent] = useState(true);
	const [form, setForm] = useState({ count: "3", ids: "", radiusM: "800", stepM: "150", centerLat: "", centerLon: "" });

	const load = useCallback(() => getWalkers(profileId).then(setData), [profileId]);

	useEffect(() => {
		setData(null);
		setError(null);
		load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load walkers"));
		const timer = setInterval(() => void load().catch(() => undefined), REFRESH_MS);

		return () => clearInterval(timer);
	}, [load]);

	async function run(action: () => Promise<WalkersOverview>) {
		setBusy(true);
		setError(null);
		try {
			setData(await action());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Request failed");
		} finally {
			setBusy(false);
		}
	}

	function onAssign(event: FormEvent) {
		event.preventDefault();
		const ids = form.ids
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number);
		const input: AssignWalkersInput = {
			...(ids.length > 0 ? { walkerIds: ids } : { count: optionalNumber(form.count) }),
			radiusM: optionalNumber(form.radiusM),
			stepM: optionalNumber(form.stepM),
			centerLat: optionalNumber(form.centerLat),
			centerLon: optionalNumber(form.centerLon),
		};
		void run(() => assignWalkers(profileId, input));
	}

	function onRemove(walkerId: number) {
		if (window.confirm(`Stop walker #${walkerId} and move it back to its seeded location? Its crossings stay.`)) {
			void run(() => removeWalker(walkerId));
		}
	}

	const target = data?.target;
	const rules = data?.rules;
	const fresh =
		target?.locationUpdatedAt && rules
			? Date.now() - new Date(target.locationUpdatedAt).getTime() < rules.windowMinutes * 60_000
			: false;
	const field = (key: keyof typeof form) => ({
		value: form[key],
		onChange: (event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value }),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Location simulation</CardTitle>
				<CardDescription>
					Synthetic profiles walk around this user so crossed paths can be tested.
					{rules
						? ` A walker steps every ${rules.stepEveryMinutes} min (cron, when the simulation is enabled) or on "Step now". A step records a crossing when the walker is within ${rules.crossingRadiusM} m of the target, the target's location is under ${rules.windowMinutes} min old, and the pair hasn't counted in the last ${rules.cooldownHours} h.`
						: null}
				</CardDescription>
				<CardAction className="flex flex-wrap items-center gap-3">
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={markPresent} onChange={(event) => setMarkPresent(event.target.checked)} />
						Mark target present
					</label>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={busy || !data?.walkers.length}
						onClick={() => void run(() => stepWalkers(profileId, markPresent))}
					>
						Step now
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="space-y-6">
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				{!data || !target || !rules ? (
					error ? null : (
						<p className="text-sm text-muted-foreground">Loading…</p>
					)
				) : (
					<>
						{data.walkingFor ? (
							<Alert>
								<AlertDescription>
									This profile is itself a walker for{" "}
									<Link to={`/users/${data.walkingFor.targetId}/walkers`} className="font-medium hover:underline">
										{data.walkingFor.name} #{data.walkingFor.targetId}
									</Link>
									.
								</AlertDescription>
							</Alert>
						) : null}
						{data.lastAction ? (
							<p className="text-sm">
								{data.lastAction.assigned !== undefined ? `Assigned ${data.lastAction.assigned} walkers. ` : null}
								{data.lastAction.stepped !== undefined ? `Stepped ${data.lastAction.stepped} walkers. ` : null}
								Crossings recorded: {data.lastAction.crossingsRecorded}.
							</p>
						) : null}

						<div className="grid gap-6 lg:grid-cols-[360px_1fr]">
							<WalkPlot data={data} />
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
								<dt className="text-muted-foreground">Area</dt>
								<dd>{target.locationHidden ? "Hidden" : (target.displayLocation ?? "—")}</dd>
								<dt className="text-muted-foreground">Coordinates</dt>
								<dd className="tabular-nums">
									{target.latitude != null && target.longitude != null
										? `${target.latitude.toFixed(5)}, ${target.longitude.toFixed(5)}`
										: "—"}
								</dd>
								<dt className="text-muted-foreground">Last location</dt>
								<dd>
									{ago(target.locationUpdatedAt)}{" "}
									<Badge variant={fresh ? "secondary" : "destructive"}>{fresh ? "Fresh" : "Stale"}</Badge>
								</dd>
								<dt className="text-muted-foreground">Pool</dt>
								<dd>{target.lookingFor === 1 ? "Dating" : "Friends"}</dd>
								<dt className="text-muted-foreground">Cross paths</dt>
								<dd>{target.shareCrossPaths ? "On" : "Off"}</dd>
							</dl>
						</div>

						<form onSubmit={onAssign} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
							<div className="space-y-1">
								<Label htmlFor="walk-count">Random walkers</Label>
								<Input id="walk-count" type="number" min={1} max={20} {...field("count")} />
							</div>
							<div className="space-y-1 sm:col-span-2 lg:col-span-1">
								<Label htmlFor="walk-ids">Or profile ids</Label>
								<Input id="walk-ids" placeholder="12, 40" {...field("ids")} />
							</div>
							<div className="space-y-1">
								<Label htmlFor="walk-radius">Radius (m)</Label>
								<Input id="walk-radius" type="number" min={100} max={5000} {...field("radiusM")} />
							</div>
							<div className="space-y-1">
								<Label htmlFor="walk-step">Step (m)</Label>
								<Input id="walk-step" type="number" min={10} max={1000} {...field("stepM")} />
							</div>
							<div className="space-y-1">
								<Label htmlFor="walk-lat">Center lat</Label>
								<Input
									id="walk-lat"
									inputMode="decimal"
									placeholder={target.latitude?.toFixed(5) ?? "required"}
									{...field("centerLat")}
								/>
							</div>
							<div className="space-y-1">
								<Label htmlFor="walk-lon">Center lon</Label>
								<Input
									id="walk-lon"
									inputMode="decimal"
									placeholder={target.longitude?.toFixed(5) ?? "required"}
									{...field("centerLon")}
								/>
							</div>
							<div className="sm:col-span-3 lg:col-span-6">
								<Button type="submit" size="sm" disabled={busy}>
									Assign walkers
								</Button>
								<span className="ml-3 text-xs text-muted-foreground">
									Random picks are synthetic, discoverable, same pool, cross paths on. Center defaults to the target.
								</span>
							</div>
						</form>

						{data.walkers.length === 0 ? (
							<p className="text-sm text-muted-foreground">No walkers around this user.</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Walker</TableHead>
										<TableHead className="text-right">Distance</TableHead>
										<TableHead>Can cross?</TableHead>
										<TableHead className="text-right">Crossings</TableHead>
										<TableHead>Last crossed</TableHead>
										<TableHead>Last step</TableHead>
										<TableHead>Walk</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.walkers.map((w) => (
										<TableRow key={w.walkerId}>
											<TableCell>
												<Link to={`/users/${w.walkerId}`} className="font-medium hover:underline">
													{w.name}
												</Link>{" "}
												<span className="text-muted-foreground">#{w.walkerId}</span>
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{w.distanceToTargetM == null ? "—" : `${w.distanceToTargetM} m`}
											</TableCell>
											<TableCell>
												{w.blockers.length === 0 ? (
													<Badge variant="secondary">
														{w.distanceToTargetM != null && w.distanceToTargetM <= rules.crossingRadiusM
															? "Yes, in radius"
															: "Yes, when in radius"}
													</Badge>
												) : (
													<div className="flex flex-wrap gap-1">
														{w.blockers.map((blocker) => (
															<Badge key={blocker} variant="destructive">
																{blocker}
															</Badge>
														))}
													</div>
												)}
											</TableCell>
											<TableCell className="text-right tabular-nums">{w.crossing?.count ?? 0}</TableCell>
											<TableCell className="whitespace-nowrap text-muted-foreground">
												{ago(w.crossing?.lastCrossedAt ?? null)}
											</TableCell>
											<TableCell className="whitespace-nowrap text-muted-foreground">{ago(w.lastStepAt)}</TableCell>
											<TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
												{w.radiusM} m / {w.stepM} m steps
											</TableCell>
											<TableCell className="whitespace-nowrap text-right">
												<Button
													type="button"
													size="sm"
													variant="ghost"
													disabled={busy}
													onClick={() => void run(() => updateWalker(w.walkerId, { active: !w.active }))}
												>
													{w.active ? "Pause" : "Resume"}
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													disabled={busy}
													onClick={() => onRemove(w.walkerId)}
												>
													Remove
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}

						<div className="space-y-2">
							<h3 className="text-sm font-medium">All crossings of this user</h3>
							{data.crossings.length === 0 ? (
								<p className="text-sm text-muted-foreground">None yet.</p>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>With</TableHead>
											<TableHead className="text-right">Count</TableHead>
											<TableHead>Last crossed</TableHead>
											<TableHead>Place</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.crossings.map((crossing) => (
											<TableRow key={crossing.otherId}>
												<TableCell>
													<Link to={`/users/${crossing.otherId}`} className="font-medium hover:underline">
														{crossing.name}
													</Link>{" "}
													<span className="text-muted-foreground">#{crossing.otherId}</span>
													{crossing.isWalker ? (
														<Badge variant="secondary" className="ml-2">
															Walker
														</Badge>
													) : crossing.isSynthetic ? (
														<Badge variant="outline" className="ml-2">
															Synthetic
														</Badge>
													) : null}
												</TableCell>
												<TableCell className="text-right tabular-nums">{crossing.count}</TableCell>
												<TableCell className="whitespace-nowrap text-muted-foreground">
													{ago(crossing.lastCrossedAt)}
												</TableCell>
												<TableCell>{crossing.lastPlace ?? "—"}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
