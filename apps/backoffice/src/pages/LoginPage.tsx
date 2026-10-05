import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { signIn, useSession } from "@/lib/auth";

export function LoginPage() {
	const { data: session, isPending } = useSession();
	const [email, setEmail] = useState("staff@haven.local");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (!isPending && session) {
		return <Navigate to="/users" replace />;
	}

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setError(null);
		setLoading(true);

		const result = await signIn.email({ email, password });
		setLoading(false);

		if (result.error) {
			setError(result.error.message ?? "Sign in failed");
		}
	}

	return (
		<div className="relative flex min-h-svh flex-col items-center justify-center bg-muted/30 p-4">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Haven backoffice</CardTitle>
					<CardDescription>Staff sign-in with your Better Auth admin account.</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={onSubmit}>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								autoComplete="username"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>
						{error ? (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						) : null}
						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? "Signing in…" : "Sign in"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
