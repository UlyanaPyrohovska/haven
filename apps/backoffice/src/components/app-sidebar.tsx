import {
	FootprintsIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	NetworkIcon,
	ShieldIcon,
	SlidersHorizontalIcon,
	UsersIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { HavenLogo } from "@/components/HavenLogo";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut, useSession } from "@/lib/auth";

export const navGroups = [
	{
		label: "Overview",
		items: [
			{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
			{ title: "Users", href: "/users", icon: UsersIcon },
		],
	},
	{
		label: "Simulation",
		items: [
			{ title: "Interaction graph", href: "/graph", icon: NetworkIcon },
			{ title: "Location walkers", href: "/walkers", icon: FootprintsIcon },
		],
	},
	{
		label: "Settings",
		items: [
			{ title: "Matching rules", href: "/matching", icon: SlidersHorizontalIcon },
			{ title: "Staff", href: "/staff", icon: ShieldIcon },
		],
	},
] as const;

export function isNavActive(pathname: string, href: string) {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
	const location = useLocation();
	const { data: session } = useSession();
	const role = (session?.user as { role?: string | null } | undefined)?.role;

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="border-b border-sidebar-border">
				<Link to="/dashboard" className="flex items-center gap-2 px-1 py-1">
					<HavenLogo />
					<div className="group-data-[collapsible=icon]:hidden">
						<p className="text-sm font-semibold tracking-tight">Haven</p>
						<p className="text-xs text-muted-foreground">Backoffice</p>
					</div>
				</Link>
			</SidebarHeader>
			<SidebarContent>
				{navGroups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											asChild
											isActive={isNavActive(location.pathname, item.href)}
											tooltip={item.title}
										>
											<Link to={item.href}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter className="border-t border-sidebar-border">
				<div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
					<p className="truncate text-sm font-medium">{session?.user.email ?? "Staff session"}</p>
					{role ? <p className="text-xs text-muted-foreground">{role}</p> : null}
				</div>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip="Sign out" onClick={() => signOut()}>
							<LogOutIcon />
							<span>Sign out</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
