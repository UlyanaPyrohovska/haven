import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { ProfilePhotoViewer } from "@/components/profile/profile-photo-viewer";
import { ProfilePublicPreview } from "@/components/profile/profile-public-preview";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemedText } from "@/components/themed-text";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen, FormScreenHeaderButton } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { Radius, Spacing } from "@/constants/app-config";
import { useProfileQuery } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/lib/auth/client";
import {
	profileAge,
	profileAgeLabel,
	profileEthnicityLabel,
	profileGenderLabel,
	profileLookingForLabel,
	profileSelectedInterests,
	profileSelfRatings,
} from "@/lib/profile/display";
import { ProfilePhotoError, pickProfilePhotoDataUrl, removeProfilePhoto, saveProfilePhoto } from "@/lib/profile/photo";

function DetailRow({ label, value }: { label: string; value: string }) {
	const theme = useTheme();

	return (
		<View style={styles.detailRow}>
			<ThemedText type="caption" style={{ color: theme.muted }}>
				{label}
			</ThemedText>
			<ThemedText type="label">{value}</ThemedText>
		</View>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View style={styles.section}>
			<ThemedText type="label">{title}</ThemedText>
			{children}
		</View>
	);
}

export default function ProfileScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const { data: session } = useSession();
	const profile = useProfileQuery(true);
	const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
	const [photoError, setPhotoError] = useState<string | null>(null);
	const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);

	const displayName = session?.user.name?.trim() || t("profile.fallbackName");
	const photoUrl = session?.user.image?.trim() || null;
	const hasPhoto = Boolean(photoUrl);

	const onPhotoError = (error: unknown) => {
		if (error instanceof ProfilePhotoError && error.code === "permission_denied") {
			setPhotoError(t("profile.photo.permissionDenied"));
			return;
		}

		setPhotoError(t("profile.photo.uploadError"));
	};

	const onChangePhoto = async () => {
		setPhotoError(null);
		setIsUpdatingPhoto(true);

		try {
			const dataUrl = await pickProfilePhotoDataUrl();

			if (!dataUrl) {
				return;
			}

			await saveProfilePhoto(dataUrl);
			setPhotoViewerOpen(false);
		} catch (error) {
			onPhotoError(error);
		} finally {
			setIsUpdatingPhoto(false);
		}
	};

	const onRemovePhoto = async () => {
		setPhotoError(null);
		setIsUpdatingPhoto(true);

		try {
			await removeProfilePhoto();
			setPhotoViewerOpen(false);
		} catch (error) {
			onPhotoError(error);
		} finally {
			setIsUpdatingPhoto(false);
		}
	};

	const onAvatarPress = () => {
		if (photoUrl) {
			setPhotoViewerOpen(true);
			return;
		}

		void onChangePhoto();
	};

	if (profile.isPending) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<ActivityIndicator color={theme.tint} />
			</View>
		);
	}

	if (profile.isError) {
		return (
			<FormScreen title={t("profile.title")} showBack>
				<ErrorBanner message={t("auth.errors.network")} />
				<ThemedText type="link" onPress={() => profile.refetch()}>
					{t("common.retry")}
				</ThemedText>
			</FormScreen>
		);
	}

	const data = profile.data;
	const age = data ? profileAge(data) : undefined;
	const publicAgeLabel = data ? profileAgeLabel(data) : undefined;
	const gender = data ? profileGenderLabel(data) : undefined;
	const ethnicity = data ? profileEthnicityLabel(data) : undefined;
	const career = typeof data?.career === "string" ? data.career.trim() : "";
	const lookingForLabel = data ? profileLookingForLabel(data) : undefined;
	const goal = typeof data?.goal === "string" ? data.goal.trim() : "";
	const bio = typeof data?.bio === "string" ? data.bio.trim() : "";
	const interests = data ? profileSelectedInterests(data) : [];
	const selfRatings = data ? profileSelfRatings(data) : [];

	const detailRows: { label: string; value: string }[] = [];

	if (age !== undefined) detailRows.push({ label: t("profile.age"), value: t("profile.ageValue", { age }) });
	if (gender) detailRows.push({ label: t("profile.gender"), value: gender });
	if (ethnicity) detailRows.push({ label: t("profile.ethnicity"), value: ethnicity });
	if (career) detailRows.push({ label: t("profile.career"), value: career });
	if (goal) detailRows.push({ label: t("profile.goal"), value: goal });

	return (
		<>
			<FormScreen
				title={t("profile.title")}
				showBack
				headerRight={
					<FormScreenHeaderButton
						accessibilityLabel={t("profile.preview.accessibilityLabel")}
						onPress={() => setPreviewOpen(true)}
					>
						<Ionicons name="eye-outline" size={20} color={theme.text} />
					</FormScreenHeaderButton>
				}
			>
				<View style={styles.hero}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={hasPhoto ? t("profile.photo.view") : t("profile.photo.add")}
						disabled={isUpdatingPhoto}
						onPress={onAvatarPress}
						style={({ pressed }) => [{ opacity: pressed || isUpdatingPhoto ? 0.75 : 1 }]}
					>
						<View style={styles.photoPreview}>
							<UserAvatar imageUrl={photoUrl} name={displayName} size={96} />
							{isUpdatingPhoto ? (
								<View style={styles.photoOverlay}>
									<ActivityIndicator color="#fff" />
								</View>
							) : null}
						</View>
					</Pressable>

					<ThemedText type="subtitle" style={styles.name}>
						{displayName}
					</ThemedText>

					{photoError ? <ErrorBanner message={photoError} /> : null}

					{lookingForLabel ? (
						<View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.tint }]}>
							<ThemedText type="caption" style={{ color: theme.tint }}>
								{lookingForLabel}
							</ThemedText>
						</View>
					) : null}
					{goal ? <ThemedText style={{ color: theme.muted, textAlign: "center" }}>{goal}</ThemedText> : null}
				</View>

				<Section title={t("profile.manage")}>
					<MenuCard>
						<MenuRow
							label={t("profile.edit")}
							subtitle={t("profile.editSubtitle")}
							onPress={() => router.push("/profile/edit")}
						/>
						<MenuDivider />
						<MenuRow
							label={t("profile.settings")}
							subtitle={t("profile.settingsSubtitle")}
							onPress={() => router.push("/profile/settings")}
						/>
					</MenuCard>
				</Section>

				{bio ? (
					<Section title={t("profile.about")}>
						<ThemedText style={{ color: theme.muted, lineHeight: 24 }}>{bio}</ThemedText>
					</Section>
				) : null}

				{detailRows.length > 0 ? (
					<Section title={t("profile.details")}>
						<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
							{detailRows.map((row, index) => (
								<View key={row.label}>
									<DetailRow label={row.label} value={row.value} />
									{index < detailRows.length - 1 ? (
										<View style={[styles.divider, { backgroundColor: theme.border }]} />
									) : null}
								</View>
							))}
						</View>
					</Section>
				) : null}

				{interests.length > 0 ? (
					<Section title={t("profile.interests")}>
						<View style={styles.chips}>
							{interests.map((interest) => (
								<View key={interest} style={[styles.chip, { backgroundColor: theme.field, borderColor: theme.border }]}>
									<ThemedText type="caption">{interest}</ThemedText>
								</View>
							))}
						</View>
					</Section>
				) : null}

				{selfRatings.length > 0 ? (
					<Section title={t("profile.personality")}>
						<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
							{selfRatings.map((rating, index) => (
								<View key={rating.label}>
									<DetailRow label={rating.label} value={t("profile.ratingValue", { value: rating.value })} />
									{index < selfRatings.length - 1 ? (
										<View style={[styles.divider, { backgroundColor: theme.border }]} />
									) : null}
								</View>
							))}
						</View>
					</Section>
				) : null}
			</FormScreen>

			{photoUrl ? (
				<ProfilePhotoViewer
					visible={photoViewerOpen}
					imageUrl={photoUrl}
					busy={isUpdatingPhoto}
					onClose={() => setPhotoViewerOpen(false)}
					onChangePhoto={() => {
						setPhotoViewerOpen(false);
						void onChangePhoto();
					}}
					onRemovePhoto={() => void onRemovePhoto()}
				/>
			) : null}

			<ProfilePublicPreview
				visible={previewOpen}
				onClose={() => setPreviewOpen(false)}
				displayName={displayName}
				photoUrl={photoUrl}
				ageLabel={publicAgeLabel}
				career={career || undefined}
				bio={bio || undefined}
				interests={interests}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	hero: {
		alignItems: "center",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	photoPreview: {
		position: "relative",
	},
	photoOverlay: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 999,
		backgroundColor: "rgba(0, 0, 0, 0.35)",
	},
	name: {
		textAlign: "center",
	},
	badge: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
	},
	section: {
		gap: Spacing.sm,
	},
	card: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
	},
	detailRow: {
		gap: Spacing.xs,
		paddingVertical: Spacing.md,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
	},
	chips: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
	chip: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
	},
});
