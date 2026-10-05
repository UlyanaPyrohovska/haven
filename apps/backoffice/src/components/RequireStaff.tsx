import { Navigate, Outlet } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut, useSession } from "@/lib/auth";

export function RequireStaff() {
	const { data: session, isPending } = useSession();

	if (isPending) {
		return <p className="text-sm text-muted-foreground">Checking session…</p>;
	}

	const role = (session?.user as { role?: string | null } | undefined)?.role;
	if (!session) {
		return <Navigate to="/login" replace />;
	}

	if (role !== "admin") {
		return (
			<Card className="max-w-lg">
				<CardHeader>
					<CardTitle>Access denied</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<AlertTitle>Staff only</AlertTitle>
						<AlertDescription>This account is not authorized for the staff backoffice.</AlertDescription>
					</Alert>
					<Button type="button" variant="outline" onClick={() => signOut()}>
						Sign out
					</Button>
				</CardContent>
			</Card>
		);
	}

	return <Outlet />;
}
