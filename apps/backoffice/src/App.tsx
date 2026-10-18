import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BackofficeLayout } from "@/components/backoffice-layout";
import { RequireStaff } from "@/components/RequireStaff";
import { GraphPage } from "@/pages/GraphPage";
import { LoginPage } from "@/pages/LoginPage";
import { StaffPage } from "@/pages/StaffPage";
import { UserDetailPage } from "@/pages/UserDetailPage";
import { UsersPage } from "@/pages/UsersPage";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route element={<RequireStaff />}>
					<Route element={<BackofficeLayout />}>
						<Route path="/users" element={<UsersPage />} />
						<Route path="/users/:profileId" element={<UserDetailPage />} />
						<Route path="/graph" element={<GraphPage />} />
						<Route path="/staff" element={<StaffPage />} />
					</Route>
				</Route>
				<Route path="/" element={<Navigate to="/users" replace />} />
				<Route path="*" element={<Navigate to="/users" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
