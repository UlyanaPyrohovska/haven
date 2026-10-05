import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authClient, useSession } from "@/lib/auth";

type StaffUser = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
	createdAt: string | Date;
};

export function StaffPage() {
	const { data: session } = useSession();
	const currentUserId = session?.user.id;

	const [staff, setStaff] = useState<StaffUser[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [form, setForm] = useState({ name: "", email: "", password: "" });

	const loadStaff = useCallback(async () => {
		setLoading(true);
		setError(null);

		const result = await authClient.admin.listUsers({
			query: {
				filterField: "role",
				filterOperator: "eq",
				filterValue: "admin",
				limit: 100,
				offset: 0,
				sortBy: "createdAt",
				sortDirection: "desc",
			},
		});

		if (result.error) {
			setError(result.error.message ?? "Failed to load staff");
			setStaff([]);
			setTotal(0);
		} else {
			const users = (result.data?.users ?? []) as StaffUser[];
			setStaff(users);
			setTotal(result.data?.total ?? users.length);
		}

		setLoading(false);
	}, []);

	useEffect(() => {
		loadStaff();
	}, [loadStaff]);

	async function onCreateStaff(event: FormEvent) {
		event.preventDefault();
		setCreating(true);
		setError(null);

		const result = await authClient.admin.createUser({
			name: form.name.trim(),
			email: form.email.trim(),
			password: form.password,
			role: "admin",
		});

		setCreating(false);

		if (result.error) {
			setError(result.error.message ?? "Failed to create staff account");
			return;
		}

		setDialogOpen(false);
		setForm({ name: "", email: "", password: "" });
		await loadStaff();
	}

	async function onDemote(userId: string) {
		if (!window.confirm("Remove admin role from this account? They will lose backoffice access.")) {
			return;
		}

		setError(null);
		const result = await authClient.admin.setRole({ userId, role: "user" });
		if (result.error) {
			setError(result.error.message ?? "Failed to update role");
			return;
		}
		await loadStaff();
	}

	async function onRemove(userId: string) {
		if (userId === currentUserId) {
			setError("You cannot delete your own staff account while signed in.");
			return;
		}

		if (!window.confirm("Delete this staff account permanently?")) {
			return;
		}

		setError(null);
		const result = await authClient.admin.removeUser({ userId });
		if (result.error) {
			setError(result.error.message ?? "Failed to remove staff account");
			return;
		}
		await loadStaff();
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Staff management</CardTitle>
					<CardDescription>
						Better Auth accounts with the <code className="text-xs">admin</code> role can access this backoffice.
					</CardDescription>
					<CardAction>
						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger asChild>
								<Button type="button">Add staff</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create staff account</DialogTitle>
									<DialogDescription>Creates a new admin user who can sign in to the backoffice.</DialogDescription>
								</DialogHeader>
								<form className="space-y-4" onSubmit={onCreateStaff}>
									<div className="space-y-2">
										<Label htmlFor="staff-name">Name</Label>
										<Input
											id="staff-name"
											value={form.name}
											onChange={(e) => setForm({ ...form, name: e.target.value })}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="staff-email">Email</Label>
										<Input
											id="staff-email"
											type="email"
											value={form.email}
											onChange={(e) => setForm({ ...form, email: e.target.value })}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="staff-password">Password</Label>
										<Input
											id="staff-password"
											type="password"
											value={form.password}
											onChange={(e) => setForm({ ...form, password: e.target.value })}
											minLength={8}
											required
										/>
									</div>
									<DialogFooter>
										<Button type="submit" disabled={creating}>
											{creating ? "Creating…" : "Create staff"}
										</Button>
									</DialogFooter>
								</form>
							</DialogContent>
						</Dialog>
					</CardAction>
				</CardHeader>
				<CardContent className="space-y-4">
					{error ? (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					<p className="text-sm text-muted-foreground">{total.toLocaleString()} staff account{total === 1 ? "" : "s"}</p>

					{loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

					{!loading && staff.length === 0 ? (
						<p className="text-sm text-muted-foreground">No staff accounts found.</p>
					) : null}

					{staff.length > 0 ? (
						<div className="rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Role</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{staff.map((member) => {
										const isSelf = member.id === currentUserId;
										return (
											<TableRow key={member.id}>
												<TableCell className="font-medium">
													{member.name}
													{isSelf ? (
														<Badge variant="secondary" className="ml-2">
															You
														</Badge>
													) : null}
												</TableCell>
												<TableCell>{member.email}</TableCell>
												<TableCell>
													<Badge variant="outline">{member.role ?? "admin"}</Badge>
												</TableCell>
												<TableCell>
													{member.banned ? (
														<Badge variant="destructive">Banned</Badge>
													) : (
														<Badge variant="secondary">Active</Badge>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															type="button"
															variant="outline"
															size="sm"
															disabled={isSelf}
															onClick={() => onDemote(member.id)}
														>
															Remove admin
														</Button>
														<Button
															type="button"
															variant="destructive"
															size="sm"
															disabled={isSelf}
															onClick={() => onRemove(member.id)}
														>
															Delete
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
