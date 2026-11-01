import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar, isNavActive, navGroups } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function BackofficeLayout() {
	const { pathname } = useLocation();
	const section = navGroups
		.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))
		.find((item) => isNavActive(pathname, item.href));

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<p className="flex-1 truncate text-sm">
						{section ? (
							<>
								<span className="text-muted-foreground">{section.group} / </span>
								<span className="font-medium">{section.title}</span>
							</>
						) : null}
					</p>
					<ModeToggle />
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
