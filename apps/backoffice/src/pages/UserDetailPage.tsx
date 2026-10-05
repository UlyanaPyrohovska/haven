import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { deleteUser, getUser, updateUser } from "@/lib/api";

const EDITABLE_PROFILE_FIELDS = [
	"displayName",
	"bio",
	"career",
	"ethnicity",
	"gender",
	"lookingFor",
	"goal",
	"birthDate",
	"discoverable",
] as const;

export function UserDetailPage() {
	const { profileId } = useParams();
	const navigate = useNavigate();
	const id = Number(profileId);

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
	const [auth, setAuth] = useState<Record<string, unknown> | null>(null);
	const [draft, setDraft] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!Number.isFinite(id)) {
			setError("Invalid profile id");
			setLoading(false);
			return;
		}

		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const data = await getUser(id);
				if (cancelled) {
					return;
				}
				setProfile(data.profile);
				setAuth(data.auth);
				setDraft({
					displayName: String(data.profile.displayName ?? ""),
					bio: String(data.profile.bio ?? ""),
					career: String(data.profile.career ?? ""),
					ethnicity: String(data.profile.ethnicity ?? ""),
					birthDate: String(data.profile.birthDate ?? ""),
					discoverable: String(data.profile.discoverable ?? true),
					authName: String(data.auth?.name ?? ""),
					authEmail: String(data.auth?.email ?? ""),
				});
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load user");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, [id]);

	const rawJson = useMemo(() => JSON.stringify({ profile, auth }, null, 2), [profile, auth]);

	async function onSave(event: FormEvent) {
		event.preventDefault();
		if (!profile) {
			return;
		}

		setSaving(true);
		setError(null);

		const body: Record<string, unknown> = {};
		for (const key of EDITABLE_PROFILE_FIELDS) {
			if (key in draft) {
				const value = draft[key]?.trim();
				if (key === "gender" || key === "lookingFor") {
					body[key] = value === "" ? null : Number(value);
				} else if (key === "discoverable") {
					body[key] = draft[key] === "true";
				} else {
					body[key] = value === "" ? null : value;
				}
			}
		}

		if (auth) {
			if (draft.authName?.trim()) {
				body.authName = draft.authName.trim();
			}
			if (draft.authEmail?.trim()) {
				body.authEmail = draft.authEmail.trim();
			}
		}

		try {
			const updated = await updateUser(id, body);
			setProfile(updated.profile);
			setAuth(updated.auth);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	}

	async function onDelete() {
		if (!window.confirm(`Delete profile #${id}? This cannot be undone.`)) {
			return;
		}

		setDeleting(true);
		setError(null);
		try {
			await deleteUser(id);
			navigate("/users");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete");
			setDeleting(false);
		}
	}

	if (loading) {
		return <p className="text-sm text-muted-foreground">Loading user…</p>;
	}

	if (!profile) {
		return (
			<div className="space-y-4">
				<Alert variant="destructive">
					<AlertDescription>{error ?? "User not found"}</AlertDescription>
				</Alert>
				<Button variant="link" asChild className="h-auto p-0">
					<Link to="/users">Back to users</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Button variant="link" asChild className="h-auto p-0">
				<Link to="/users">← Users</Link>
			</Button>

			<Card>
				<CardHeader>
					<CardTitle>Profile #{id}</CardTitle>
					<CardDescription>Edit profile fields and linked auth account.</CardDescription>
					<CardAction>
						<Button type="button" variant="destructive" onClick={onDelete} disabled={deleting}>
							{deleting ? "Deleting…" : "Delete user"}
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent>
					{error ? (
						<Alert variant="destructive" className="mb-6">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					<form id="user-edit-form" className="space-y-6" onSubmit={onSave}>
						<div>
							<h3 className="mb-3 text-sm font-medium">Profile</h3>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="displayName">Display name</Label>
									<Input
										id="displayName"
										value={draft.displayName ?? ""}
										onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="birthDate">Birth date (YYYY-MM-DD)</Label>
									<Input
										id="birthDate"
										value={draft.birthDate ?? ""}
										onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="career">Career</Label>
									<Input
										id="career"
										value={draft.career ?? ""}
										onChange={(e) => setDraft({ ...draft, career: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="ethnicity">Ethnicity</Label>
									<Input
										id="ethnicity"
										value={draft.ethnicity ?? ""}
										onChange={(e) => setDraft({ ...draft, ethnicity: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="lookingFor">Looking for</Label>
									<Input id="lookingFor" value={String(profile.lookingFor ?? "")} readOnly disabled />
									<p className="text-xs text-muted-foreground">0 = friends, 1 = dating</p>
								</div>
								<div className="space-y-2">
									<Label>Discoverable</Label>
									<Select
										value={draft.discoverable ?? "true"}
										onValueChange={(value) => setDraft({ ...draft, discoverable: value })}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="true">Yes</SelectItem>
											<SelectItem value="false">No</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="mt-4 space-y-2">
								<Label htmlFor="bio">Bio</Label>
								<Textarea
									id="bio"
									rows={4}
									value={draft.bio ?? ""}
									onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
								/>
							</div>
						</div>

						<Separator />

						{auth ? (
							<div>
								<h3 className="mb-3 text-sm font-medium">Better Auth account</h3>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="authName">Name</Label>
										<Input
											id="authName"
											value={draft.authName ?? ""}
											onChange={(e) => setDraft({ ...draft, authName: e.target.value })}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="authEmail">Email</Label>
										<Input
											id="authEmail"
											type="email"
											value={draft.authEmail ?? ""}
											onChange={(e) => setDraft({ ...draft, authEmail: e.target.value })}
										/>
									</div>
								</div>
								<p className="mt-2 text-sm text-muted-foreground">
									Role: {String(auth.role ?? "user")} · Banned: {String(auth.banned ?? false)}
								</p>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">No linked Better Auth user (synthetic profile).</p>
						)}
					</form>
				</CardContent>
				<CardFooter className="justify-end gap-2 border-t">
					<Button type="button" variant="outline" onClick={() => navigate("/users")}>
						Cancel
					</Button>
					<Button type="submit" form="user-edit-form" disabled={saving}>
						{saving ? "Saving…" : "Save changes"}
					</Button>
				</CardFooter>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Full record</CardTitle>
					<CardDescription>Raw profile and auth payload from the API.</CardDescription>
				</CardHeader>
				<CardContent>
					<pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 text-xs">{rawJson}</pre>
				</CardContent>
			</Card>
		</div>
	);
}
