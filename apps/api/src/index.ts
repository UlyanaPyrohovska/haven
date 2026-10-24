import { createApp } from "@/app";
import { getDb } from "@/db";
import { resolveRecCooldownHours } from "@/lib/recommendation-cadence";
import { notify } from "@/modules/notifications/service";
import { runTick } from "@/modules/simulation/engine";

export { ChatRoom } from "@/chat-room";

const app = createApp();

export default {
	fetch: app.fetch,
	scheduled(_controller, env, ctx) {
		if (env.SIMULATION_ENABLED !== "true") {
			return;
		}

		const db = getDb(env.DATABASE_URL);

		ctx.waitUntil(
			runTick(db, {
				cooldownHours: resolveRecCooldownHours(env.REC_COOLDOWN_HOURS),
				notify: (profileId, notice) => notify(env, db, profileId, notice),
			}).then((stats) => console.log("simulation tick", stats)),
		);
	},
} satisfies ExportedHandler<CloudflareBindings>;
