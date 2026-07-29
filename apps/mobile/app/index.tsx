import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Strings } from "@/constants/strings";

export default function HomeScreen() {
	return (
		<ThemedView style={styles.container}>
			<ThemedText type="title">{Strings.home.title}</ThemedText>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
});
