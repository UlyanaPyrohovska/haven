import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChipGroup } from "@/components/ui/chip-group";
import { Dialog } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { blockUser, type ReportReason, ReportReasons, reportUser } from "@/lib/api/safety";

export type SafetyKind = "report" | "block";

type SafetyDialogsProps = {
	candidateId: number;
	name: string;
	kind: SafetyKind | null;
	onClose: () => void;
	/** Runs after the report or block succeeds; the dialog is already closed. */
	onDone: () => Promise<void> | void;
};

/** Report and block confirmation dialogs, shared by the profile and chat screens. */
export function SafetyDialogs({ candidateId, name, kind, onClose, onDone }: SafetyDialogsProps) {
	const { t } = useTranslation();
	const [reportReason, setReportReason] = useState<ReportReason | undefined>();

	const safety = useMutation({
		mutationFn: (action: SafetyKind) =>
			action === "report" && reportReason ? reportUser(candidateId, reportReason) : blockUser(candidateId),
		onSuccess: async () => {
			onClose();
			await onDone();
		},
	});

	return (
		<>
			<Dialog
				visible={kind === "report"}
				icon="flag-outline"
				tone="danger"
				title={t("connections.safety.reportTitle", { name })}
				message={t("connections.safety.reportMessage")}
				confirmLabel={t("connections.safety.reportConfirm")}
				onConfirm={() => reportReason && safety.mutate("report")}
				cancelLabel={t("common.cancel")}
				onCancel={onClose}
				loading={safety.isPending}
			>
				<ChipGroup
					label={t("connections.safety.reasonLabel")}
					hideLabel
					options={ReportReasons.map((value) => ({ value, label: t(`connections.safety.reasons.${value}`) }))}
					value={reportReason}
					onChange={setReportReason}
				/>
				{safety.isError ? <ErrorBanner message={t("connections.safety.error")} /> : null}
			</Dialog>

			<Dialog
				visible={kind === "block"}
				icon="ban-outline"
				tone="danger"
				title={t("connections.safety.blockTitle", { name })}
				message={t("connections.safety.blockMessage")}
				confirmLabel={t("connections.safety.blockConfirm")}
				onConfirm={() => safety.mutate("block")}
				cancelLabel={t("common.cancel")}
				onCancel={onClose}
				loading={safety.isPending}
			>
				{safety.isError ? <ErrorBanner message={t("connections.safety.error")} /> : null}
			</Dialog>
		</>
	);
}
