import { type FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { LocationWalkers } from "@/components/LocationWalkers";
import { ModeBadge } from "@/components/ModeBadge";
import { PageHeader } from "@/components/page-header";
import { RecommendationScores } from "@/components/RecommendationScores";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteUser, getUser, type StaffUserDetail, updateUser } from "@/lib/api";
import { cn } from "@/lib/utils";

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

const TABS = [
	{ to: "", label: "Profile", end: true },
	{ to: "recommendations", label: "Recommendations", end: false },
	{ to: "walkers", label: "Location walkers", end: false },
	{ to: "raw", label: "Raw data", end: false },
] as const;

type UserContext = { id: number; detail: StaffUserDetail; setDetail: (detail: StaffUserDetail) => void };

function useUser() {
	return useOutletContext<UserContext>();
}

/** Loads the user once and shares it with the tab routes below. */
export function UserDetailPage() {
	const { profileId } = useParams();
	const navigate = useNavigate();
	const id = Number(profileId);

	const [loading, setLoading] = useState(true);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [detail, setDetail] = useState<StaffUserDetail | null>(null);

	useEffect(() => {
		if (!Number.isFinite(id)) {
			setError("Invalid profile id");
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		getUser(id)
			.then((data) => {
				if (!cancelled) setDetail(data);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load user");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [id]);

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

	if (!detail) {
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

	const { profile, auth } = detail;

	return (
		<div className="space-y-4">
			<Button variant="link" asChild className="h-auto p-0 text-muted-foreground">
				<Link to="/users">← Users</Link>
			</Button>

			<PageHeader
				title={
					<>
						{String(profile.displayName ?? auth?.name ?? "Unnamed")}
						<span className="font-normal text-muted-foreground">#{id}</span>
						<ModeBadge lookingFor={profile.lookingFor} />
						<Badge variant={profile.isSynthetic ? "secondary" : "outline"}>
							{profile.isSynthetic ? "Synthetic" : "Real"}
						</Badge>
						{auth?.banned ? <Badge variant="destructive">Banned</Badge> : null}
					</>
				}
				description={auth?.email ?? "No linked auth account"}
				actions={
					<Button type="button" variant="outline" onClick={onDelete} disabled={deleting}>
						{deleting ? "Deleting…" : "Delete user"}
					</Button>
				}
			/>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<nav className="flex gap-1 overflow-x-auto border-b">
				{TABS.map((tab) => (
					<NavLink
						key={tab.label}
						to={tab.to}
						end={tab.end}
						className={({ isActive }) =>
							cn(
								"-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
								isActive
									? "border-primary font-medium text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)
						}
					>
						{tab.label}
					</NavLink>
				))}
			</nav>

			<Outlet context={{ id, detail, setDetail } satisfies UserContext} />
		</div>
	);
}

export function UserProfileTab() {
	const { id, detail, setDetail } = useUser();
	const { profile, auth } = detail;
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [draft, setDraft] = useState<Record<string, string>>(() => ({
		displayName: String(profile.displayName ?? ""),
		bio: String(profile.bio ?? ""),
		career: String(profile.career ?? ""),
		ethnicity: String(profile.ethnicity ?? ""),
		birthDate: String(profile.birthDate ?? ""),
		discoverable: String(profile.discoverable ?? true),
		authName: String(auth?.name ?? ""),
		authEmail: String(auth?.email ?? ""),
	}));

	const field = (key: string) => ({
		value: draft[key] ?? "",
		onChange: (event: { target: { value: string } }) => {
			setSaved(false);
			setDraft({ ...draft, [key]: event.target.value });
		},
	});

	async function onSave(event: FormEvent) {
		event.preventDefault();
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
			setDetail(await updateUser(id, body));
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="grid gap-4 lg:grid-cols-[1fr_320px]">
			<Card>
				<CardHeader>
					<CardTitle>Profile</CardTitle>
					<CardDescription>Fields the user sees and edits in the app.</CardDescription>
				</CardHeader>
				<CardContent>
					{error ? (
						<Alert variant="destructive" className="mb-6">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}
					<form id="user-edit-form" className="space-y-4" onSubmit={onSave}>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="displayName">Display name</Label>
								<Input id="displayName" {...field("displayName")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="birthDate">Birth date (YYYY-MM-DD)</Label>
								<Input id="birthDate" {...field("birthDate")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="career">Career</Label>
								<Input id="career" {...field("career")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="ethnicity">Ethnicity</Label>
								<Input id="ethnicity" {...field("ethnicity")} />
							</div>
							<div className="space-y-2">
								<Label>Discoverable</Label>
								<Select
									value={draft.discoverable ?? "true"}
									onValueChange={(value) => field("discoverable").onChange({ target: { value } })}
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
						<div className="space-y-2">
							<Label htmlFor="bio">Bio</Label>
							<Textarea id="bio" rows={4} {...field("bio")} />
						</div>
						{auth ? (
							<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="authName">Account name</Label>
									<Input id="authName" {...field("authName")} />
								</div>
								<div className="space-y-2">
									<Label htmlFor="authEmail">Account email</Label>
									<Input id="authEmail" type="email" {...field("authEmail")} />
								</div>
							</div>
						) : null}
					</form>
				</CardContent>
				<CardFooter className="justify-end gap-3 border-t">
					{saved ? <span className="text-sm text-muted-foreground">Saved</span> : null}
					<Button type="submit" form="user-edit-form" disabled={saving}>
						{saving ? "Saving…" : "Save changes"}
					</Button>
				</CardFooter>
			</Card>

			<Card className="h-fit">
				<CardHeader>
					<CardTitle>Account</CardTitle>
				</CardHeader>
				<CardContent>
					{auth ? (
						<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
							<dt className="text-muted-foreground">Role</dt>
							<dd>{auth.role ?? "user"}</dd>
							<dt className="text-muted-foreground">Email verified</dt>
							<dd>{auth.emailVerified ? "Yes" : "No"}</dd>
							<dt className="text-muted-foreground">Banned</dt>
							<dd>{auth.banned ? `Yes${auth.banReason ? ` (${auth.banReason})` : ""}` : "No"}</dd>
							<dt className="text-muted-foreground">Joined</dt>
							<dd>{new Date(auth.createdAt).toLocaleDateString()}</dd>
							<dt className="text-muted-foreground">Auth id</dt>
							<dd className="truncate font-mono text-xs leading-5" title={auth.id}>
								{auth.id}
							</dd>
						</dl>
					) : (
						<p className="text-sm text-muted-foreground">Synthetic profile, no Better Auth account.</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export function UserRecommendationsTab() {
	return <RecommendationScores profileId={useUser().id} />;
}

export function UserWalkersTab() {
	return <LocationWalkers profileId={useUser().id} />;
}

export function UserRawTab() {
	const { detail } = useUser();

	return (
		<pre className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/40 p-4 text-xs">
			{JSON.stringify(detail, null, 2)}
		</pre>
	);
}
