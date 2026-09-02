import { Text, type TextProps } from "react-native";

import { type TextStyleName, TextStyles } from "@/constants/app-config";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
	lightColor?: string;
	darkColor?: string;
	type?: TextStyleName;
};

export function ThemedText({ style, lightColor, darkColor, type = "body", ...rest }: ThemedTextProps) {
	const textColor = useThemeColor({ light: lightColor, dark: darkColor }, "text");
	const linkColor = useThemeColor({ light: lightColor, dark: darkColor }, "link");

	return <Text style={[TextStyles[type], { color: type === "link" ? linkColor : textColor }, style]} {...rest} />;
}
