import { Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { Colors } from "@/constants/app-config";

import { SPLASH_HTML, SPLASH_PLAY_MS } from "./splash-html";

type HavenSplashWebViewProps = {
	reduceMotion?: boolean;
	onComplete?: () => void;
	replayKey?: number;
};

export function HavenSplashWebView({
	reduceMotion = false,
	onComplete,
	replayKey = 0,
}: HavenSplashWebViewProps) {
	const injectedJavaScript = reduceMotion
		? `
      document.body.classList.add('reduced-motion');
      true;
    `
		: onComplete
			? `
      setTimeout(function() {
        window.ReactNativeWebView.postMessage('done');
      }, ${SPLASH_PLAY_MS});
      true;
    `
			: "true;";

	const onMessage = (event: WebViewMessageEvent) => {
		if (event.nativeEvent.data === "done") {
			onComplete?.();
		}
	};

	return (
		<View style={styles.container}>
			<WebView
				key={replayKey}
				source={{ html: SPLASH_HTML }}
				style={styles.webview}
				scrollEnabled={false}
				bounces={false}
				overScrollMode="never"
				showsHorizontalScrollIndicator={false}
				showsVerticalScrollIndicator={false}
				originWhitelist={["*"]}
				javaScriptEnabled
				domStorageEnabled
				injectedJavaScript={injectedJavaScript}
				onMessage={onMessage}
				androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.brand.splash,
	},
	webview: {
		flex: 1,
		backgroundColor: Colors.brand.splash,
	},
});
