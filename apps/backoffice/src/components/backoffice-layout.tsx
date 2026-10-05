import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { signOut, useSession } from "@/lib/auth";

export function BackofficeLayout() {
	const { data: session } = useSession();
	const role = (session?.user as { role?: string | null } | undefined)?.role;

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<div className="flex flex-1 items-center justify-between gap-3">
						<p className="truncate text-sm text-muted-foreground">
							{session?.user.email ? (
								<>
									Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
									{role ? ` · ${role}` : null}
								</>
							) : (
								"Staff session"
							)}
						</p>
						<div className="flex items-center gap-2">
							<ModeToggle />
							<Button type="button" variant="outline" size="sm" onClick={() => signOut()}>
								Sign out
							</Button>
						</div>
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
