import { Stack } from "expo-router";

export default function ConnectionsLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				animation: "fade",
				animationDuration: 200,
			}}
		/>
	);
}
