import { type FormEvent, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type BioEmbeddingBackfill,
	backfillBioEmbeddings,
	getMatchingConfig,
	type MatchingConfig,
	type MatchingConfigResponse,
	updateMatchingConfig,
} from "@/lib/api";

type FieldKey =
	| "batchSize"
	| "cooldownHours"
	| "bio"
	| "interest"
	| "geo"
	| "pref"
	| "mood"
	| "dailyAnswer"
	| "crossPathsLambda"
	| "fairnessMu"
	| "exposureCap"
	| "exposureWindowDays"
	| "preferenceLambda";
type Form = Record<FieldKey, string>;

const CADENCE_FIELDS = [
	{ key: "batchSize", label: "Batch size", hint: "People per daily drop (1–50).", step: "1" },
	{ key: "cooldownHours", label: "Cooldown (hours)", hint: "Wait before a user gets a new batch.", step: "0.5" },
] as const;

const WEIGHT_FIELDS = [
	{ key: "bio", label: "Bio similarity", hint: "Dropped and the rest renormalized when a bio is missing." },
	{ key: "interest", label: "Interests", hint: "17 interests plus custom interests." },
	{ key: "geo", label: "Distance", hint: "exp(−km / 25); 0.5 when location is missing." },
	{ key: "pref", label: "Preferences", hint: "u's preferences against v's self-ratings." },
	{ key: "mood", label: "Mood", hint: "Today's check-ins via a mood matrix; dropped when either side has none." },
	{
		key: "dailyAnswer",
		label: "Daily answer",
		hint: "Word overlap of today's answers (0.5 = none); dropped when either side has none.",
	},
] as const;

const FAIRNESS_FIELDS = [
	{
		key: "fairnessMu",
		label: "Exposure penalty μ (0–1)",
		hint: "Ranks by score × (1 − μ · e / (e + e₀)), e = times shown in the window. 0 turns it off.",
	},
	{
		key: "exposureCap",
		label: "Exposure cap",
		hint: "Shown this often in the window → only fills leftover slots. Empty = no cap.",
		step: "1",
		optional: true,
	},
	{ key: "exposureWindowDays", label: "Window (days)", hint: "How far back impressions count (1–30).", step: "1" },
] as const;

function toForm(config: MatchingConfig): Form {
	return {
		batchSize: String(config.batchSize),
		cooldownHours: String(config.cooldownHours),
		...(Object.fromEntries(Object.entries(config.weights).map(([key, value]) => [key, String(value)])) as Record<
			keyof MatchingConfig["weights"],
			string
		>),
		crossPathsLambda: String(config.crossPathsLambda),
		fairnessMu: String(config.fairnessMu),
		exposureCap: config.exposureCap === null ? "" : String(config.exposureCap),
		exposureWindowDays: String(config.exposureWindowDays),
		preferenceLambda: String(config.preferenceLambda),
	};
}

function fromForm(form: Form): MatchingConfig {
	return {
		batchSize: Number(form.batchSize),
		cooldownHours: Number(form.cooldownHours),
		weights: {
			bio: Number(form.bio),
			interest: Number(form.interest),
			geo: Number(form.geo),
			pref: Number(form.pref),
			mood: Number(form.mood),
			dailyAnswer: Number(form.dailyAnswer),
		},
		crossPathsLambda: Number(form.crossPathsLambda),
		fairnessMu: Number(form.fairnessMu),
		exposureCap: form.exposureCap.trim() === "" ? null : Number(form.exposureCap),
		exposureWindowDays: Number(form.exposureWindowDays),
		preferenceLambda: Number(form.preferenceLambda),
	};
}

export function MatchingRulesPage() {
	const [response, setResponse] = useState<MatchingConfigResponse | null>(null);
	const [form, setForm] = useState<Form | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		let cancelled = false;

		getMatchingConfig()
			.then((data) => {
				if (cancelled) return;
				setResponse(data);
				setForm(toForm(data.config));
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load matching rules");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	if (!form || !response) {
		return error ? (
			<Alert variant="destructive">
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		) : (
			<p className="text-sm text-muted-foreground">Loading…</p>
		);
	}

	const config = fromForm(form);
	const weightSum = Object.values(config.weights).reduce((sum, weight) => sum + weight, 0);
	const weightsValid = Math.abs(weightSum - 1) < 0.001;

	function setField(key: FieldKey, value: string) {
		setSaved(false);
		setForm((current) => (current ? { ...current, [key]: value } : current));
	}

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			const data = await updateMatchingConfig(config);
			setResponse(data);
			setForm(toForm(data.config));
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save matching rules");
		} finally {
			setSaving(false);
		}
	}

	function renderField(
		field: { key: FieldKey; label: string; hint: string; step?: string; optional?: boolean },
		defaultValue: number | null,
	) {
		return (
			<div key={field.key} className="space-y-2">
				<Label htmlFor={`rule-${field.key}`}>{field.label}</Label>
				<Input
					id={`rule-${field.key}`}
					type="number"
					inputMode="decimal"
					step={field.step ?? "0.01"}
					min="0"
					required={!field.optional}
					value={form?.[field.key] ?? ""}
					onChange={(event) => setField(field.key, event.target.value)}
				/>
				<p className="text-xs text-muted-foreground">
					{field.hint} Default {defaultValue ?? "none"}.
				</p>
			</div>
		);
	}

	const { defaults } = response;

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-xl font-semibold tracking-tight">Matching rules</h1>
				<p className="text-sm text-muted-foreground">
					Changes apply to the next batch generated. Existing recommendations keep their stored scores; use Regenerate
					on a user to rebuild theirs.
					{response.updatedAt
						? ` Last saved ${new Date(response.updatedAt).toLocaleString()}.`
						: " Using code defaults (nothing saved yet)."}
				</p>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<form id="matching-rules-form" className="grid gap-4 lg:grid-cols-2" onSubmit={onSubmit}>
				<Card>
					<CardHeader>
						<CardTitle>Cadence</CardTitle>
						<CardDescription>How many people a user sees and how often.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{CADENCE_FIELDS.map((field) => renderField(field, defaults[field.key]))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Score weights</CardTitle>
						<CardDescription className={weightsValid ? undefined : "text-destructive"}>
							One-way score = weighted sum of these. Must sum to 1 (now {weightSum.toFixed(3)}).
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4 sm:grid-cols-2">
						{WEIGHT_FIELDS.map((field) => renderField(field, defaults.weights[field.key]))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Crossed-paths boost</CardTitle>
						<CardDescription>score × (1 + λ · (1 − e^(−count / 3))). 0 turns the boost off.</CardDescription>
					</CardHeader>
					<CardContent>
						{renderField(
							{
								key: "crossPathsLambda",
								label: "Boost strength λ (0–1)",
								hint: "Keep ≤ 0.25 so it doesn't double-count distance.",
							},
							defaults.crossPathsLambda,
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Learned preferences</CardTitle>
						<CardDescription>
							Blends stated preferences with what a user liked and passed on: (1 − s) · stated + s · learned, s = λ · n
							/ (n + 10). 0 turns it off.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{renderField(
							{
								key: "preferenceLambda",
								label: "Learning share λ (0–1)",
								hint: "Max weight of learned preferences once a user has many decisions.",
							},
							defaults.preferenceLambda,
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Exposure fairness</CardTitle>
						<CardDescription>
							Spreads impressions so the same popular profiles don't fill every feed. Pending likers are exempt.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4 sm:grid-cols-2">
						{FAIRNESS_FIELDS.map((field) => renderField(field, defaults[field.key]))}
					</CardContent>
					<CardFooter className="justify-end gap-2 border-t">
						{saved ? <span className="mr-auto text-sm text-muted-foreground">Saved.</span> : null}
						<Button type="button" variant="outline" onClick={() => setForm(toForm(defaults))} disabled={saving}>
							Reset to defaults
						</Button>
						<Button type="submit" disabled={saving || !weightsValid}>
							{saving ? "Saving…" : "Save"}
						</Button>
					</CardFooter>
				</Card>
			</form>

			<BioEmbeddingsCard />
		</div>
	);
}

/** Run once per environment after deploy and after every `pnpm db:seed` (the seed empties user_embeddings). */
function BioEmbeddingsCard() {
	const [running, setRunning] = useState(false);
	const [result, setResult] = useState<BioEmbeddingBackfill | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function onBackfill() {
		setRunning(true);
		setError(null);
		setResult(null);
		try {
			setResult(await backfillBioEmbeddings());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Backfill failed");
		} finally {
			setRunning(false);
		}
	}

	return (
		<Card className="lg:max-w-[calc(50%-0.5rem)]">
			<CardHeader>
				<CardTitle>Bio embeddings</CardTitle>
				<CardDescription>
					Re-embeds every bio with Workers AI and removes vectors of cleared bios. Run after a deploy or a reseed; it
					takes up to a minute.
				</CardDescription>
			</CardHeader>
			{error || result ? (
				<CardContent>
					{error ? (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : (
						<p className="text-sm text-muted-foreground">
							{result?.embedded} bios embedded, {result?.removed} vectors removed.
						</p>
					)}
				</CardContent>
			) : null}
			<CardFooter className="justify-end border-t">
				<Button type="button" onClick={onBackfill} disabled={running}>
					{running ? "Embedding…" : "Re-embed all bios"}
				</Button>
			</CardFooter>
		</Card>
	);
}
