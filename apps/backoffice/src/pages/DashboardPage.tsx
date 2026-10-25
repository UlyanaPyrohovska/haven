import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type DailyCount, getStats, type StaffStats } from "@/lib/api";

const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

function formatDay(day: string) {
	return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

function StatTile({ label, value, detail }: { label: string; value: number; detail?: string }) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-2xl tabular-nums">{value.toLocaleString()}</CardTitle>
				{detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
			</CardHeader>
		</Card>
	);
}

/** One series per UTC day; hovering a bar swaps the readout from the period total to that day. */
function DailyBars({ title, unit, series }: { title: string; unit: string; series: DailyCount[] }) {
	const [hovered, setHovered] = useState<number | null>(null);
	const max = Math.max(1, ...series.map((point) => point.count));
	const total = series.reduce((sum, point) => sum + point.count, 0);
	const point = hovered === null ? null : series[hovered];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription className="tabular-nums">
					{point
						? `${formatDay(point.day)}: ${point.count} ${unit}`
						: `${total.toLocaleString()} ${unit} in the last ${series.length} days`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="relative flex h-40 items-end border-b">
					<span className="absolute top-0 left-0 text-xs text-muted-foreground tabular-nums">{max}</span>
					{series.map((entry, index) => (
						<div
							key={entry.day}
							role="img"
							aria-label={`${formatDay(entry.day)}: ${entry.count} ${unit}`}
							className="flex h-full flex-1 items-end px-px"
							onMouseEnter={() => setHovered(index)}
							onMouseLeave={() => setHovered(null)}
						>
							<div
								className={`w-full rounded-t-sm ${hovered === index ? "bg-primary" : "bg-chart-2"}`}
								style={{ height: `${(entry.count / max) * 100}%`, minHeight: entry.count ? 2 : 0 }}
							/>
						</div>
					))}
				</div>
				<div className="mt-1 flex justify-between text-xs text-muted-foreground">
					<span>{series[0] ? formatDay(series[0].day) : null}</span>
					<span>{series.at(-1) ? formatDay(series.at(-1)?.day ?? "") : null}</span>
				</div>
			</CardContent>
		</Card>
	);
}

/** Two-part share bar with a legend that carries the numbers, so identity is never colour alone. */
function SplitBar({ parts }: { parts: { label: string; value: number; className: string }[] }) {
	const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;

	return (
		<div className="space-y-2">
			<div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
				{parts.map((part) => (
					<div key={part.label} className={part.className} style={{ width: `${(part.value / total) * 100}%` }} />
				))}
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{parts.map((part) => (
					<span key={part.label} className="flex items-center gap-1.5">
						<span className={`size-2.5 rounded-full ${part.className}`} />
						{part.label}
						<span className="text-muted-foreground tabular-nums">
							{part.value.toLocaleString()} · {Math.round((part.value / total) * 100)}%
						</span>
					</span>
				))}
			</div>
		</div>
	);
}

function MoodBars({ moods, days }: { moods: StaffStats["moods"]; days: number }) {
	const max = Math.max(1, ...moods.map((mood) => mood.count));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Moods</CardTitle>
				<CardDescription>Check-ins in the last {days} days</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{moods.map((mood) => (
					<div key={mood.mood} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-2 text-sm">
						<span className="capitalize">{mood.mood}</span>
						<div className="h-3">
							<div
								className="h-full rounded-r-sm bg-chart-2"
								style={{ width: `${(mood.count / max) * 100}%`, minWidth: mood.count ? 2 : 0 }}
							/>
						</div>
						<span className="text-right text-muted-foreground tabular-nums">{mood.count}</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

export function DashboardPage() {
	const [stats, setStats] = useState<StaffStats | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		getStats()
			.then((data) => {
				if (!cancelled) setStats(data);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	if (!stats) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{["a", "b", "c", "d"].map((key) => (
					<Skeleton key={key} className="h-24" />
				))}
			</div>
		);
	}

	const { profiles, activity } = stats;
	const real = profiles.total - profiles.synthetic;

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
				<p className="text-sm text-muted-foreground">Platform activity at a glance. Days are UTC.</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile label="Profiles" value={profiles.total} detail={`${real.toLocaleString()} real`} />
				<StatTile label="Matches" value={activity.matches} detail={`${activity.messages.toLocaleString()} messages`} />
				<StatTile
					label="Check-ins today"
					value={activity.moodCheckinsToday}
					detail={`${activity.dailyAnswersToday.toLocaleString()} daily answers`}
				/>
				<StatTile label="Reports" value={activity.reports} detail="All time" />
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<DailyBars title="New real users" unit="sign-ups" series={stats.signupsByDay} />
				<DailyBars title="New matches" unit="matches" series={stats.matchesByDay} />
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Profiles</CardTitle>
						<CardDescription>Pool and account type</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<SplitBar
							parts={[
								{ label: "Friends", value: profiles.total - profiles.dating, className: "bg-teal-500" },
								{ label: "Dating", value: profiles.dating, className: "bg-rose-500" },
							]}
						/>
						<SplitBar
							parts={[
								{ label: "Real", value: real, className: "bg-primary" },
								{ label: "Agents", value: profiles.synthetic, className: "bg-chart-1" },
							]}
						/>
					</CardContent>
				</Card>
				<MoodBars moods={stats.moods} days={stats.days} />
			</div>
		</div>
	);
}
