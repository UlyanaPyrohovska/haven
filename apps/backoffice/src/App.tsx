import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BackofficeLayout } from "@/components/backoffice-layout";
import { RequireStaff } from "@/components/RequireStaff";
import { DashboardPage } from "@/pages/DashboardPage";
import { GraphPage } from "@/pages/GraphPage";
import { LoginPage } from "@/pages/LoginPage";
import { MatchingRulesPage } from "@/pages/MatchingRulesPage";
import { StaffPage } from "@/pages/StaffPage";
import {
	UserDetailPage,
	UserProfileTab,
	UserRawTab,
	UserRecommendationsTab,
	UserWalkersTab,
} from "@/pages/UserDetailPage";
import { UsersPage } from "@/pages/UsersPage";
import { WalkersPage } from "@/pages/WalkersPage";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route element={<RequireStaff />}>
					<Route element={<BackofficeLayout />}>
						<Route path="/dashboard" element={<DashboardPage />} />
						<Route path="/users" element={<UsersPage />} />
						<Route path="/users/:profileId" element={<UserDetailPage />}>
							<Route index element={<UserProfileTab />} />
							<Route path="recommendations" element={<UserRecommendationsTab />} />
							<Route path="walkers" element={<UserWalkersTab />} />
							<Route path="raw" element={<UserRawTab />} />
						</Route>
						<Route path="/graph" element={<GraphPage />} />
						<Route path="/walkers" element={<WalkersPage />} />
						<Route path="/matching" element={<MatchingRulesPage />} />
						<Route path="/staff" element={<StaffPage />} />
					</Route>
				</Route>
				<Route path="/" element={<Navigate to="/dashboard" replace />} />
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
