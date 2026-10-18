import { errors } from "@/lib/errors";
import * as recommendationRepository from "@/modules/recommendations/repository";
import type { ViewerContext } from "@/modules/recommendations/service";
import * as repository from "./repository";
import type { ReportBody } from "./schemas";

async function requireCandidate({ db, viewer }: ViewerContext, candidateId: number) {
	const candidate =
		candidateId === viewer.id ? null : await recommendationRepository.findCandidateProfile(db, candidateId);

	if (!candidate) {
		throw errors.not_found;
	}
}

export async function block(ctx: ViewerContext, candidateId: number) {
	await requireCandidate(ctx, candidateId);
	await repository.blockPair(ctx.db, ctx.viewer.id, candidateId);

	return { blocked: true as const };
}

export async function report(ctx: ViewerContext, candidateId: number, body: ReportBody) {
	await requireCandidate(ctx, candidateId);
	await repository.insertReport(ctx.db, {
		reporterId: ctx.viewer.id,
		reportedId: candidateId,
		reason: body.reason,
		details: body.details || null,
	});
	await repository.blockPair(ctx.db, ctx.viewer.id, candidateId);

	return { blocked: true as const };
}
