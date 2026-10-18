/**
 * Creates (or refreshes) the App Review demo login with a finished profile and a fresh
 * recommendation batch. Goes through the running API so passwords are hashed by Better Auth.
 *
 *   DEMO_EMAIL=... DEMO_PASSWORD=... pnpm db:seed-demo -- https://<api-host>
 */
const apiUrl = (process.argv.slice(2).find((arg) => arg !== "--") ?? "http://localhost:8787").replace(/\/$/, "");
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;

if (!email || !password) {
	throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD.");
}

// Better Auth checks Origin on cookie-based requests; this one is in trustedOrigins.
const origin = "http://localhost:5173";

async function authenticate(): Promise<string> {
	const post = (path: string, body: object) =>
		fetch(`${apiUrl}/auth${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Origin: origin },
			body: JSON.stringify(body),
		});

	let response = await post("/sign-in/email", { email, password });

	if (!response.ok) {
		response = await post("/sign-up/email", { email, password, name: "Alex Demo" });
	}

	if (!response.ok) {
		throw new Error(`Sign-in and sign-up failed (${response.status}): ${await response.text()}`);
	}

	const cookie = response.headers
		.getSetCookie()
		.map((header) => header.split(";")[0])
		.join("; ");

	if (!cookie) {
		throw new Error("No session cookie returned.");
	}

	return cookie;
}

const profile = {
	displayName: "Alex",
	birthDate: "1998-04-12",
	gender: 0,
	career: "Product designer",
	lookingFor: 0,
	goal: "To meet new people",
	bio: "Coffee, long walks and live music. New in town and looking for people to explore it with.",
	interestSports: 4,
	interestTvsports: 2,
	interestExercise: 7,
	interestDining: 9,
	interestMuseums: 8,
	interestArt: 8,
	interestHiking: 9,
	interestGaming: 3,
	interestClubbing: 4,
	interestReading: 8,
	interestTv: 5,
	interestTheater: 6,
	interestMovies: 7,
	interestConcerts: 9,
	interestMusic: 10,
	interestShopping: 4,
	interestYoga: 6,
	prefAttr: 15,
	prefSinc: 20,
	prefIntel: 20,
	prefFun: 20,
	prefAmb: 10,
	prefShar: 15,
	selfAttr: 7,
	selfSinc: 8,
	selfIntel: 8,
	selfFun: 8,
	selfAmb: 6,
	selfShar: 7,
	displayLocation: "Berlin",
	latitude: 52.52,
	longitude: 13.4,
};

const cookie = await authenticate();
const api = (path: string, init: RequestInit = {}) =>
	fetch(`${apiUrl}${path}`, {
		...init,
		headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
	});

const saved = await api("/me", { method: "PATCH", body: JSON.stringify(profile) });

if (!saved.ok) {
	throw new Error(`Saving the profile failed (${saved.status}): ${await saved.text()}`);
}

const regenerated = await api("/recommendations/regenerate", { method: "POST" });

if (!regenerated.ok) {
	throw new Error(`Generating recommendations failed (${regenerated.status}): ${await regenerated.text()}`);
}

const { count } = (await regenerated.json()) as { count: number };

console.log(`Demo account ${email} ready with ${count} recommendations.`);
