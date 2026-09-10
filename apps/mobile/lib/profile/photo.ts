import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { updateUser } from "@/lib/auth/client";

export const PROFILE_PHOTO_MAX_EDGE = 512;

export type ProfilePhotoErrorCode = "permission_denied" | "processing_failed" | "upload_failed";

export class ProfilePhotoError extends Error {
	constructor(
		readonly code: ProfilePhotoErrorCode,
		message?: string,
	) {
		super(message ?? code);
		this.name = "ProfilePhotoError";
	}
}

/** Opens the photo library, crops to a square, and returns a JPEG data URL. */
export async function pickProfilePhotoDataUrl(): Promise<string | null> {
	const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

	if (!permission.granted) {
		throw new ProfilePhotoError("permission_denied");
	}

	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ["images"],
		allowsEditing: true,
		aspect: [1, 1],
		quality: 1,
	});

	if (result.canceled || !result.assets[0]) {
		return null;
	}

	const manipulated = await ImageManipulator.manipulateAsync(
		result.assets[0].uri,
		[{ resize: { width: PROFILE_PHOTO_MAX_EDGE } }],
		{
			compress: 0.85,
			format: ImageManipulator.SaveFormat.JPEG,
			base64: true,
		},
	);

	if (!manipulated.base64) {
		throw new ProfilePhotoError("processing_failed");
	}

	return `data:image/jpeg;base64,${manipulated.base64}`;
}

export async function saveProfilePhoto(dataUrl: string): Promise<void> {
	const { error } = await updateUser({ image: dataUrl });

	if (error) {
		throw new ProfilePhotoError("upload_failed", error.message);
	}
}

export async function removeProfilePhoto(): Promise<void> {
	const { error } = await updateUser({ image: "" });

	if (error) {
		throw new ProfilePhotoError("upload_failed", error.message);
	}
}
