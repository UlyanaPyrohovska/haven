import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { UserAvatar } from "@/components/profile/user-avatar";
import { useSession } from "@/lib/auth/client";

type ProfileHeaderButtonProps = {
	size?: number;
};

/** Top-right profile avatar — matches home and connections headers. */
export function ProfileHeaderButton({ size = 44 }: ProfileHeaderButtonProps) {
	const router = useRouter();
	const { t } = useTranslation();
	const { data: session } = useSession();
	const photoUrl = session?.user.image?.trim() || null;
	const name = session?.user.name ?? "You";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={t("home.profileAccessibilityLabel")}
			hitSlop={8}
			onPress={() => router.push("/profile")}
			style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
		>
			<UserAvatar imageUrl={photoUrl} name={name} size={size} />
		</Pressable>
	);
}
