import type { Db } from "@/db";
import type { PushNotice } from "@/lib/messaging/push";
import { AGENT, agentAccepts, hiddenProfile } from "@/lib/simulation/agent-decision";
import { agentUtility } from "@/lib/simulation/agent-utility";
import { generateRecommendations } from "@/modules/recommendations/generator";
import * as recommendationsRepository from "@/modules/recommendations/repository";
import { ensureBatch, recordDecision } from "@/modules/recommendations/service";
import * as repository from "./repository";

export type TickOptions = {
	/** Synthetic agents sampled to act this tick. */
	limit?: number;
	cooldownHours: number;
	/** Seeds every agent decision; defaults to the current time. */
	tickId?: string;
	/** Pushes to real users; agents have no devices. */
	notify?: (profileId: number, notice: PushNotice) => Promise<void>;
};

export type TickStats = {
	tickId: string;
	inboundAnswered: number;
	agentsActed: number;
	decisions: number;
	accepts: number;
	newMatches: number;
	realBatches: number;
};

type Agent = recommendationsRepository.ScoringViewerProfile;

/**
 * One simulated day:
 * 1. synthetic agents reply to likes they received (from real users or other agents),
 * 2. a sample of agents gets a fresh batch (agents only see agents) and decides on it,
 * 3. every real user gets their daily drop if it is due.
 *
 * shortcut: a tick handles a bounded sample (~20 Neon subrequests per agent); move to Queues/Workflows
 * if the Worker plan's subrequest cap is hit at the chosen limit.
 */
export async function runTick(db: Db, opts: TickOptions): Promise<TickStats> {
	const tickId = opts.tickId ?? new Date().toISOString();
	const stats: TickStats = {
		tickId,
		inboundAnswered: 0,
		agentsActed: 0,
		decisions: 0,
		accepts: 0,
		newMatches: 0,
		realBatches: 0,
	};

	const decide = async (agent: Agent, other: Agent, notifyOnMatch = false) => {
		const hidden = hiddenProfile(agent);
		const accept = agentAccepts(
			agentUtility(hidden.profile, other, hidden.weights),
			`${tickId}:${agent.id}:${other.id}`,
		);
		const { matched } = await recordDecision(db, agent, other.id, accept ? 1 : 0);

		stats.decisions++;
		if (accept) stats.accepts++;
		if (matched) stats.newMatches++;
		if (matched && notifyOnMatch) await opts.notify?.(other.id, { kind: "match", candidateId: agent.id });
	};

	const inbound = await repository.listPendingInboundForSynthetic(db, AGENT.inboundLimit);
	const inboundProfiles = await profilesById(
		db,
		inbound.flatMap((row) => [row.agentId, row.likerId]),
	);

	for (const { agentId, likerId } of inbound) {
		const agent = inboundProfiles.get(agentId);
		const liker = inboundProfiles.get(likerId);

		if (agent && liker) {
			// The liker may be a real user waiting on this answer.
			await decide(agent, liker, true);
			stats.inboundAnswered++;
		}
	}

	const agentIds = await repository.sampleSyntheticAgentIds(db, opts.limit ?? AGENT.defaultTickLimit);

	for (const agentId of agentIds) {
		let pending = await repository.listPendingRecommendationRows(db, agentId);

		if (pending.length === 0) {
			await generateRecommendations(db, agentId, { syntheticOnly: true });
			pending = await repository.listPendingRecommendationRows(db, agentId);
		}

		const profiles = await profilesById(db, [agentId, ...pending.map((row) => row.candidateId)]);
		const agent = profiles.get(agentId);

		if (!agent) continue;

		for (const rec of pending) {
			const candidate = profiles.get(rec.candidateId);
			if (!candidate) continue;

			await decide(agent, candidate);
			await recommendationsRepository.markRecommendationActedOn(db, rec.id);
		}

		stats.agentsActed++;
	}

	for (const viewer of await repository.listRealProfiles(db)) {
		// One bad profile must not cost everyone after it their drop.
		try {
			const batch = await ensureBatch(db, viewer, opts.cooldownHours);
			if (batch.status === "generated" && batch.count > 0) {
				stats.realBatches++;
				await opts.notify?.(viewer.id, { kind: "recommendations" });
			}
		} catch (err) {
			console.error("simulation tick: batch failed", viewer.id, err);
		}
	}

	return stats;
}

async function profilesById(db: Db, ids: number[]): Promise<Map<number, Agent>> {
	const profiles = await recommendationsRepository.listScoringProfilesByIds(db, [...new Set(ids)]);

	return new Map(profiles.map((profile) => [profile.id, profile]));
}
