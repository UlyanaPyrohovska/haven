import { Hono } from "hono";

// shortcut: placeholder contact, replace with a monitored address before App Store submission.
const CONTACT_EMAIL = "ulyana.pyrohovska@gmail.com";
const UPDATED = "16 October 2026";

const page = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Haven</title>
<style>
:root { color-scheme: light dark; --bg: #fffdf8; --fg: #1f1b16; --muted: #6b6359; }
@media (prefers-color-scheme: dark) { :root { --bg: #1a1714; --fg: #f3ede4; --muted: #b3a999; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 -apple-system, system-ui, sans-serif; }
main { max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 28px; margin-bottom: 4px; }
h2 { font-size: 19px; margin-top: 32px; }
p.meta { color: var(--muted); margin-top: 0; }
a { color: inherit; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;

const privacy = page(
	"Privacy policy",
	`<h1>Privacy policy</h1>
<p class="meta">Last updated ${UPDATED}</p>
<p>Haven is a matching app built as a university thesis project. This page explains what personal data Haven collects, why, and how you control it.</p>

<h2>Who is responsible</h2>
<p>The Haven project is the controller of your data. Contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>What we collect</h2>
<ul>
<li><strong>Account:</strong> name, email address and a hashed password.</li>
<li><strong>Profile:</strong> date of birth, gender, career, what you are looking for (friends or dating), your goal, bio, interest ratings, self-ratings and partner preferences. Ethnicity only if you choose to give it.</li>
<li><strong>Photo:</strong> the profile photo you upload.</li>
<li><strong>Location:</strong> approximate coordinates and an area label, if you allow location access. Other users never see your coordinates, only a rough distance or area, and you can hide your location in settings.</li>
<li><strong>Mood check-ins and daily question answers:</strong> one per day, if you give them.</li>
<li><strong>Activity:</strong> the recommendations shown to you, your accept and decline decisions, and your matches.</li>
<li><strong>Safety reports:</strong> reports you file about other users, and reports filed about you.</li>
</ul>

<h2>Why we use it</h2>
<ul>
<li>To run your account and show you compatible people in the same pool (friends or dating).</li>
<li>To show parts of your profile to people Haven recommends to you, within the visibility settings you choose.</li>
<li>To review reports and keep the community safe.</li>
<li>For the thesis evaluation of the matching algorithm, only in anonymised, aggregate form.</li>
</ul>
<p>The legal bases are performance of our contract with you (running the service) and your consent (location, photo, and optional fields such as ethnicity). You can withdraw consent at any time by removing the data or deleting your account.</p>

<h2>What we do not do</h2>
<p>Haven shows no ads, does not sell your data, and does not use third-party tracking or analytics.</p>

<h2>Where it is stored</h2>
<p>Your data is stored in a PostgreSQL database hosted by Neon in the EU (Frankfurt, Germany). The API runs on Cloudflare Workers, which processes requests in transit.</p>

<h2>How long we keep it</h2>
<p>We keep your data until you delete your account. Deleting your account removes your account, profile, photo, location, mood check-ins, answers, recommendations and matches immediately. Reports you filed about others are kept without your identity, so staff can still act on them.</p>

<h2>Your rights</h2>
<p>Under the GDPR you can access, correct, export or delete your data, object to or restrict its use, and complain to your data protection authority. You can edit your profile and delete your account in the app under Profile → Settings. For anything else, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>Age</h2>
<p>Haven is only for people aged 18 and over.</p>

<h2>Changes</h2>
<p>If this policy changes, we update the date at the top of this page.</p>`,
);

const support = page(
	"Support",
	`<h1>Support</h1>
<p>Questions, problems, or a safety concern about another user? Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We review reports within 24 hours.</p>
<p>In the app you can report or block anyone from their profile, and delete your account under Profile → Settings.</p>
<p><a href="/privacy">Privacy policy</a></p>`,
);

export const legal = new Hono();

legal.get("/privacy", (c) => c.html(privacy));
legal.get("/support", (c) => c.html(support));

export default legal;
