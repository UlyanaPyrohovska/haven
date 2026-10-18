import { createApp } from "@/app";
import { getDb } from "@/db";
import { resolveRecCooldownHours } from "@/lib/recommendation-cadence";
import { runTick } from "@/modules/simulation/engine";

const app = createApp();

export default {
	fetch: app.fetch,
	scheduled(_controller, env, ctx) {
		if (env.SIMULATION_ENABLED !== "true") {
			return;
		}

		ctx.waitUntil(
			runTick(getDb(env.DATABASE_URL), { cooldownHours: resolveRecCooldownHours(env.REC_COOLDOWN_HOURS) }).then(
				(stats) => console.log("simulation tick", stats),
			),
		);
	},
} satisfies ExportedHandler<CloudflareBindings>;
