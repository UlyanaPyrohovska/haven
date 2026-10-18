import { NetworkIcon, ShieldIcon, UsersIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
	{ title: "Users", href: "/users", icon: UsersIcon, description: "Platform profiles" },
	{ title: "Graph", href: "/graph", icon: NetworkIcon, description: "Interactions and simulation" },
	{ title: "Staff", href: "/staff", icon: ShieldIcon, description: "Backoffice accounts" },
] as const;

export function AppSidebar() {
	const location = useLocation();

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="border-b border-sidebar-border">
				<div className="px-2 py-1">
					<p className="text-sm font-semibold tracking-tight">Haven</p>
					<p className="text-xs text-muted-foreground">Backoffice</p>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Management</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => {
								const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

								return (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton asChild isActive={active} tooltip={item.title}>
											<Link to={item.href}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
