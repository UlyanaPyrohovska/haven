import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { Dialog } from "@/components/ui/dialog";
import { Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

type InfoButtonProps = {
	title: string;
	message: string;
};

/** Small "i" icon that opens a one-action dialog explaining the surrounding feature. */
export function InfoButton({ title, message }: InfoButtonProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [open, setOpen] = useState(false);

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={title}
				onPress={() => setOpen(true)}
				hitSlop={Spacing.sm}
			>
				<Ionicons name="information-circle-outline" size={18} color={theme.muted} />
			</Pressable>
			<Dialog
				visible={open}
				icon="sparkles-outline"
				title={title}
				message={message}
				confirmLabel={t("common.gotIt")}
				onConfirm={() => setOpen(false)}
			/>
		</>
	);
}
