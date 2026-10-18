import { apiFetch } from "@/lib/api/client";

export const ReportReasons = ["inappropriate_photo", "harassment", "spam_or_fake", "underage", "other"] as const;

export type ReportReason = (typeof ReportReasons)[number];

export async function blockUser(candidateId: number): Promise<void> {
	const response = await apiFetch(`/users/${candidateId}/block`, { method: "POST" });

	if (!response.ok) {
		throw new Error(`Failed to block user (${response.status})`);
	}
}

/** Files a report for staff review; the API also blocks the user. */
export async function reportUser(candidateId: number, reason: ReportReason): Promise<void> {
	const response = await apiFetch(`/users/${candidateId}/report`, {
		method: "POST",
		body: JSON.stringify({ reason }),
	});

	if (!response.ok) {
		throw new Error(`Failed to report user (${response.status})`);
	}
}
