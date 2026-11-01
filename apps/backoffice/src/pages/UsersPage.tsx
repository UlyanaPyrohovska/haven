import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ModeBadge } from "@/components/ModeBadge";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listUsers, type StaffUserSummary, type UserTypeFilter } from "@/lib/api";

const LIMIT = 25;

export function UsersPage() {
	const navigate = useNavigate();
	// Filters live in the URL so "back" from a user returns to the same list.
	const [params, setParams] = useSearchParams();
	const search = params.get("q") ?? "";
	const type = params.get("type") ?? "all";
	const pool = params.get("pool") ?? "all";
	const offset = Number(params.get("offset") ?? 0) || 0;

	const [q, setQ] = useState(search);
	const [users, setUsers] = useState<StaffUserSummary[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);

		listUsers({
			q: search || undefined,
			type: type === "all" ? undefined : (type as UserTypeFilter),
			lookingFor: pool === "all" ? undefined : Number(pool),
			limit: LIMIT,
			offset,
		})
			.then((data) => {
				if (cancelled) return;
				setUsers(data.users);
				setTotal(data.total);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load users");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [search, type, pool, offset]);

	function update(changes: Record<string, string | number>) {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(changes)) {
			if (value === "" || value === "all" || value === 0) next.delete(key);
			else next.set(key, String(value));
		}
		setParams(next, { replace: true });
	}

	function onSearch(event: FormEvent) {
		event.preventDefault();
		update({ q: q.trim(), offset: 0 });
	}

	return (
		<div className="space-y-4">
			<PageHeader title="Users" description={loading ? "Loading…" : `${total.toLocaleString()} profiles match`} />

			<div className="flex flex-col gap-2 sm:flex-row">
				<form className="flex min-w-0 flex-1 gap-2" onSubmit={onSearch}>
					<Input
						aria-label="Search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search by profile id, email, name or auth id"
					/>
					<Button type="submit" variant="secondary">
						Search
					</Button>
				</form>
				<Select value={type} onValueChange={(value) => update({ type: value, offset: 0 })}>
					<SelectTrigger className="w-full sm:w-36" aria-label="Type">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All types</SelectItem>
						<SelectItem value="real">Real users</SelectItem>
						<SelectItem value="synthetic">Synthetic</SelectItem>
					</SelectContent>
				</Select>
				<Select value={pool} onValueChange={(value) => update({ pool: value, offset: 0 })}>
					<SelectTrigger className="w-full sm:w-36" aria-label="Pool">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All pools</SelectItem>
						<SelectItem value="1">Dating</SelectItem>
						<SelectItem value="0">Friends</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Pool</TableHead>
							<TableHead>Type</TableHead>
							<TableHead className="text-right">Created</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{!loading && users.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
									No users match these filters.
								</TableCell>
							</TableRow>
						) : null}
						{users.map((user) => (
							<TableRow
								key={user.profileId}
								className="cursor-pointer"
								onClick={() => navigate(`/users/${user.profileId}`)}
							>
								<TableCell>
									<Link to={`/users/${user.profileId}`} className="font-medium hover:underline">
										{user.displayName ?? "Unnamed"}
									</Link>{" "}
									<span className="text-muted-foreground">#{user.profileId}</span>
								</TableCell>
								<TableCell className="max-w-[240px] truncate text-muted-foreground">{user.email ?? "—"}</TableCell>
								<TableCell>
									<ModeBadge lookingFor={user.lookingFor} />
								</TableCell>
								<TableCell>
									<Badge variant={user.isSynthetic ? "secondary" : "outline"}>
										{user.isSynthetic ? "Synthetic" : "Real"}
									</Badge>
								</TableCell>
								<TableCell className="text-right whitespace-nowrap text-muted-foreground">
									{new Date(user.createdAt).toLocaleDateString()}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-end gap-3">
				<span className="text-sm text-muted-foreground">
					{total === 0 ? "0 results" : `${offset + 1}–${Math.min(offset + LIMIT, total)} of ${total}`}
				</span>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={offset === 0}
					onClick={() => update({ offset: Math.max(0, offset - LIMIT) })}
				>
					Previous
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={offset + LIMIT >= total}
					onClick={() => update({ offset: offset + LIMIT })}
				>
					Next
				</Button>
			</div>
		</div>
	);
}
