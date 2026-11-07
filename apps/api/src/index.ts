import { createApp } from "@/app";
import { getDb } from "@/db";
import { notify } from "@/modules/notifications/service";
import { loadMatchingConfig } from "@/modules/recommendations/repository";
import { runTick } from "@/modules/simulation/engine";
import { stepWalkers } from "@/modules/simulation/walkers";

export { ChatRoom } from "@/chat-room";

const app = createApp();

/** Must match the walker cron in wrangler.jsonc. */
const WALKER_CRON = "*/10 * * * *";

export default {
	fetch: app.fetch,
	scheduled(controller, env, ctx) {
		if (env.SIMULATION_ENABLED !== "true") {
			return;
		}

		const db = getDb(env);

		if (controller.cron === WALKER_CRON) {
			ctx.waitUntil(
				stepWalkers(db)
					.then((stats) => console.log("walker step", stats))
					.catch((err) => console.error("walker step failed", err, err?.cause)),
			);
			return;
		}

		ctx.waitUntil(
			loadMatchingConfig(db, env.REC_COOLDOWN_HOURS)
				.then((config) =>
					runTick(db, {
						cooldownHours: config.cooldownHours,
						notify: (profileId, notice) => notify(env, db, profileId, notice),
					}),
				)
				.then((stats) => console.log("simulation tick", stats))
				.catch((err) => console.error("simulation tick failed", err, err?.cause)),
		);
	},
} satisfies ExportedHandler<CloudflareBindings>;
