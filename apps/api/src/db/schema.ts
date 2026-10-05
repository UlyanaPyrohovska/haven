import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	doublePrecision,
	index,
	integer,
	pgTable,
	primaryKey,
	real,
	serial,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	varchar,
	vector,
} from "drizzle-orm/pg-core";

import { LookingFor } from "@/lib/looking-for";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	role: text("role").default("user"),
	banned: boolean("banned").default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		impersonatedBy: text("impersonated_by"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

// Better Auth generates the `user` table automatically via CLI —
// don't hand-write it. Just leave a comment placeholder or import
// Better Auth's generated types when you need them.

export const userProfiles = pgTable(
	"user_profiles",
	{
		id: serial("id").primaryKey(),
		userId: text("user_id"), // FK to Better Auth's user.id (uuid string)
		// Not enforced as an FK in Drizzle because Better Auth manages that table
		// — we manually maintain the reference.

		isSynthetic: boolean("is_synthetic").notNull().default(false),

		/** Shown on connection cards; real users get the first token of Better Auth `user.name`. */
		displayName: varchar("display_name", { length: 80 }),

		// Auth — nullable, only populated for real users
		email: varchar("email", { length: 255 }).unique(),
		passwordHash: varchar("password_hash", { length: 255 }),

		// Demographic
		gender: smallint("gender"), // 0 = female, 1 = male (per CSV)
		// Stored instead of age so it never goes stale. The synthetic CSV only carries an
		// age, so seeding derives a birth date from it.
		birthDate: date("birth_date"),
		ethnicity: varchar("ethnicity", { length: 100 }),
		career: varchar("career", { length: 100 }),
		/** 0 = friends, 1 = dating. Matching only surfaces same-mode profiles. */
		lookingFor: smallint("looking_for").notNull().default(LookingFor.friends),
		goal: varchar("goal", { length: 100 }),

		// Location
		latitude: doublePrecision("latitude"),
		longitude: doublePrecision("longitude"),
		/** Label shown in the app header; can differ from GPS coordinates. */
		displayLocation: varchar("display_location", { length: 200 }),
		/** When true, the header shows a hidden-location state instead of `displayLocation`. */
		locationHidden: boolean("location_hidden").notNull().default(false),

		// Free text
		bio: text("bio"),
		/** Optional portrait URL (e.g. Unsplash CDN). Null when derived at read time. */
		photoUrl: text("photo_url"),

		// Interests (1–10 Likert)
		interestSports: smallint("interest_sports"),
		interestTvsports: smallint("interest_tvsports"),
		interestExercise: smallint("interest_exercise"),
		interestDining: smallint("interest_dining"),
		interestMuseums: smallint("interest_museums"),
		interestArt: smallint("interest_art"),
		interestHiking: smallint("interest_hiking"),
		interestGaming: smallint("interest_gaming"),
		interestClubbing: smallint("interest_clubbing"),
		interestReading: smallint("interest_reading"),
		interestTv: smallint("interest_tv"),
		interestTheater: smallint("interest_theater"),
		interestMovies: smallint("interest_movies"),
		interestConcerts: smallint("interest_concerts"),
		interestMusic: smallint("interest_music"),
		interestShopping: smallint("interest_shopping"),
		interestYoga: smallint("interest_yoga"),

		// Preferences — 6-dim (what the user is looking for)
		prefAttr: real("pref_attr"),
		prefSinc: real("pref_sinc"),
		prefIntel: real("pref_intel"),
		prefFun: real("pref_fun"),
		prefAmb: real("pref_amb"),
		prefShar: real("pref_shar"),

		// Self-ratings — 6-dim (how the user rates themselves)
		selfAttr: smallint("self_attr"),
		selfSinc: smallint("self_sinc"),
		selfIntel: smallint("self_intel"),
		selfFun: smallint("self_fun"),
		selfAmb: smallint("self_amb"),
		selfShar: smallint("self_shar"),

		/** When false, the profile is hidden from new recommendations. */
		discoverable: boolean("discoverable").notNull().default(true),
		showAge: boolean("show_age").notNull().default(true),
		showCareer: boolean("show_career").notNull().default(true),
		showBio: boolean("show_bio").notNull().default(true),
		showInterests: boolean("show_interests").notNull().default(true),
		/** When false, distance and location labels are hidden from others. */
		shareLocation: boolean("share_location").notNull().default(true),
		/** When false, cross-paths tracking and counts are disabled for this user. */
		shareCrossPaths: boolean("share_cross_paths").notNull().default(true),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		index("user_profiles_user_id_idx").on(t.userId),
		index("user_profiles_synthetic_idx").on(t.isSynthetic),
		index("user_profiles_looking_for_idx").on(t.lookingFor),
		index("user_profiles_lat_lon_idx").on(t.latitude, t.longitude),
	],
);

// ────────────────────────────────────────────────────────────────
// user_embeddings — semantic vectors for the bio
// ────────────────────────────────────────────────────────────────
export const userEmbeddings = pgTable(
	"user_embeddings",
	{
		userProfileId: integer("user_profile_id")
			.primaryKey()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		bio: vector("bio", { dimensions: 384 }), // all-MiniLM-L6-v2
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		// HNSW index for cosine similarity — created empty, fills as rows arrive
		index("user_embeddings_bio_hnsw").using("hnsw", t.bio.op("vector_cosine_ops")),
	],
);

// ────────────────────────────────────────────────────────────────
// interactions — one row per directed pair with decision + ratings
// ────────────────────────────────────────────────────────────────
export const interactions = pgTable(
	"interactions",
	{
		id: serial("id").primaryKey(),
		userA: integer("user_a")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		userB: integer("user_b")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		distanceKm: real("distance_km"),
		scoreAToB: real("score_a_to_b"),
		scoreBToA: real("score_b_to_a"),
		decA: smallint("dec_a"), // 0 = reject, 1 = accept
		decB: smallint("dec_b"),
		match: boolean("match").notNull().default(false),

		// // Speed-dating-style ratings from A about B
		// attrA: smallint("attr_a"),
		// sincA: smallint("sinc_a"),
		// intelA: smallint("intel_a"),
		// funA: smallint("fun_a"),
		// likeA: smallint("like_a"),

		// // and from B about A
		// attrB: smallint("attr_b"),
		// sincB: smallint("sinc_b"),
		// intelB: smallint("intel_b"),
		// funB: smallint("fun_b"),
		// likeB: smallint("like_b"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("interactions_pair_uniq").on(t.userA, t.userB),
		index("interactions_user_a_idx").on(t.userA),
		index("interactions_user_b_idx").on(t.userB),
		index("interactions_match_idx").on(t.match),
	],
);

// ────────────────────────────────────────────────────────────────
// friendships — undirected edges, stored with a < b
// ────────────────────────────────────────────────────────────────
export const friendships = pgTable(
	"friendships",
	{
		userA: integer("user_a")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		userB: integer("user_b")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.userA, t.userB] }), index("friendships_user_b_idx").on(t.userB)],
);

// ────────────────────────────────────────────────────────────────
// mood_checkins — one mood per user per calendar day (UTC)
// ────────────────────────────────────────────────────────────────
export const moodCheckins = pgTable(
	"mood_checkins",
	{
		id: serial("id").primaryKey(),
		userProfileId: integer("user_profile_id")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		mood: smallint("mood").notNull(),
		checkinDate: date("checkin_date").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("mood_checkins_profile_date_uniq").on(t.userProfileId, t.checkinDate)],
);

// ────────────────────────────────────────────────────────────────
// daily_question_answers — one answer per user per calendar day (UTC)
// ────────────────────────────────────────────────────────────────
export const dailyQuestionAnswers = pgTable(
	"daily_question_answers",
	{
		id: serial("id").primaryKey(),
		userProfileId: integer("user_profile_id")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		answer: varchar("answer", { length: 500 }).notNull(),
		answerDate: date("answer_date").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("daily_question_answers_profile_date_uniq").on(t.userProfileId, t.answerDate)],
);

// ────────────────────────────────────────────────────────────────
// recommendations — audit log of what the system surfaced
//   critical for the fairness / exposure metrics you'll report on
// ────────────────────────────────────────────────────────────────
export const recommendations = pgTable(
	"recommendations",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		candidateId: integer("candidate_id")
			.notNull()
			.references(() => userProfiles.id, { onDelete: "cascade" }),
		score: real("score"),
		rank: smallint("rank"),
		shownAt: timestamp("shown_at").defaultNow().notNull(),
		actedOn: boolean("acted_on").notNull().default(false),
	},
	(t) => [
		uniqueIndex("recommendations_user_candidate_uniq").on(t.userId, t.candidateId),
		index("recommendations_user_id_idx").on(t.userId),
		index("recommendations_candidate_id_idx").on(t.candidateId),
	],
);
