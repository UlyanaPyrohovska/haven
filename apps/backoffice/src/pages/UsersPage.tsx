import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteUser, listUsers, type StaffUserSummary } from "@/lib/api";

export function UsersPage() {
	const [q, setQ] = useState("");
	const [search, setSearch] = useState("");
	const [users, setUsers] = useState<StaffUserSummary[]>([]);
	const [total, setTotal] = useState(0);
	const [offset, setOffset] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<number | null>(null);

	const limit = 25;

	useEffect(() => {
		let cancelled = false;

		async function loadUsers() {
			setLoading(true);
			setError(null);
			try {
				const data = await listUsers({ q: search || undefined, limit, offset });
				if (!cancelled) {
					setUsers(data.users);
					setTotal(data.total);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load users");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadUsers();

		return () => {
			cancelled = true;
		};
	}, [search, offset]);

	function onSearch(event: FormEvent) {
		event.preventDefault();
		setOffset(0);
		setSearch(q.trim());
	}

	async function onDelete(profileId: number) {
		if (!window.confirm(`Delete profile #${profileId}? This cannot be undone.`)) {
			return;
		}

		setDeletingId(profileId);
		setError(null);
		try {
			await deleteUser(profileId);
			const data = await listUsers({ q: search || undefined, limit, offset });
			setUsers(data.users);
			setTotal(data.total);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete user");
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Users</CardTitle>
				<CardDescription>{total.toLocaleString()} profiles in the database</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSearch}>
					<div className="min-w-0 flex-1 space-y-2">
						<Label htmlFor="search">Search</Label>
						<Input
							id="search"
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="Profile id, email, display name, or auth id"
						/>
					</div>
					<Button type="submit">Search</Button>
				</form>

				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}

				{loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

				{!loading && users.length === 0 ? (
					<p className="text-sm text-muted-foreground">No users matched your search.</p>
				) : null}

				{users.length > 0 ? (
					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Profile</TableHead>
									<TableHead>Display name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{users.map((user) => (
									<TableRow key={user.profileId}>
										<TableCell>
											<Link
												to={`/users/${user.profileId}`}
												className="font-medium text-primary underline-offset-4 hover:underline"
											>
												#{user.profileId}
											</Link>
										</TableCell>
										<TableCell>{user.displayName ?? "—"}</TableCell>
										<TableCell className="max-w-[200px] truncate">{user.email ?? user.userId ?? "—"}</TableCell>
										<TableCell>
											<Badge variant={user.isSynthetic ? "secondary" : "outline"}>
												{user.isSynthetic ? "Synthetic" : "Real"}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">{new Date(user.createdAt).toLocaleString()}</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button type="button" variant="outline" size="sm" asChild>
													<Link to={`/users/${user.profileId}`}>Edit</Link>
												</Button>
												<Button
													type="button"
													variant="destructive"
													size="sm"
													disabled={deletingId === user.profileId}
													onClick={() => onDelete(user.profileId)}
												>
													{deletingId === user.profileId ? "Deleting…" : "Delete"}
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				) : null}

				<div className="flex flex-wrap items-center gap-3">
					<Button
						type="button"
						variant="outline"
						disabled={offset === 0}
						onClick={() => setOffset(Math.max(0, offset - limit))}
					>
						Previous
					</Button>
					<span className="text-sm text-muted-foreground">
						{total === 0 ? "0 results" : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
					</span>
					<Button
						type="button"
						variant="outline"
						disabled={offset + limit >= total}
						onClick={() => setOffset(offset + limit)}
					>
						Next
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
