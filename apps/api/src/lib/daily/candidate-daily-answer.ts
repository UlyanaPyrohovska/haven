import type { Db } from "@/db";
import { utcToday } from "@/lib/daily/mood";
import * as dailyQuestionRepository from "@/modules/daily-question/repository";

/** Short answers for synthetic profiles (no DB row needed). */
const SYNTHETIC_DAILY_ANSWERS = [
	"A small dog from my street",
	"Finding a vinyl record I'd been hunting for months",
	"Coffee with an old friend on the waterfront",
	"My team finally shipped the feature we'd been grinding on",
	"A stranger helped me carry groceries in the rain",
	"Sunset from the hill behind my apartment",
	"Finally nailing a recipe I've been tweaking",
	"A long walk with no destination",
	"My niece's laugh on a video call",
	"Discovering a tiny bookstore around the corner",
	"Sleeping in without an alarm",
	"A playlist that matched my mood perfectly",
	"Finishing a book I didn't want to end",
	"Shared silence with someone I trust",
	"A perfect espresso at my favorite café",
	"Getting back into sketching after months",
	"A message from someone I missed",
	"The smell of bread from the bakery",
	"Clearing my inbox for the first time in weeks",
	"Dancing alone in the kitchen",
	"A stranger complimented my jacket",
	"Finding tickets to a show I wanted",
	"My plant sprouted a new leaf",
	"A quiet morning before the city woke up",
	"Helping a neighbor fix their bike",
	"Re-reading an old journal entry",
	"A swim that washed the day away",
	"Cooking dinner for friends",
	"Learning three chords on the guitar",
	"A dream I actually remembered",
	"The first cool breeze of autumn",
	"A podcast episode that changed my perspective",
	"Organizing a drawer I'd ignored for years",
	"A handwritten note in the mail",
	"Running into someone at the market",
	"Watching clouds from a park bench",
	"A joke that made me cry laughing",
	"Fixing something instead of replacing it",
	"A photo that captured the light just right",
	"Trying a new route on my commute",
	"Volunteering for an hour on Saturday",
	"A nap that actually helped",
	"Stargazing away from streetlights",
	"Sharing food with someone who needed it",
	"A workout that felt effortless",
	"Finding money in an old coat pocket",
	"A museum exhibit I didn't expect to love",
	"Saying no to something draining",
	"Saying yes to something spontaneous",
	"A voice memo from my best friend",
	"Fresh flowers on the kitchen table",
	"Finally understanding a concept at work",
	"A child drawing they gave me",
	"Rain on the window while reading",
	"A thrift-store jacket that fits perfectly",
	"Watching the sea change color at dusk",
	"A recipe passed down from my grandmother",
	"Clearing a trail on a hike",
	"A moment of gratitude at random",
	"Learning a word in another language",
	"A busker playing my favorite song",
	"Waking up before my alarm feeling rested",
	"A board game night that ran late",
	"Planting herbs on the balcony",
	"A compliment about something I worked hard on",
	"Finding an old photo that made me smile",
	"Trying meditation for ten minutes",
	"A stranger holding the door during a rush",
	"Cooking something entirely from scratch",
	"A crossword finished on the train",
	"Watching my favorite team win",
	"A quiet cup of tea before bed",
	"Sketching strangers at the café",
	"A road trip playlist with friends",
	"Donating clothes that finally left my closet",
	"A rainbow after a sudden shower",
	"Learning to say thank you in sign language",
	"A poem I copied into my notes app",
	"Fixing a leaky faucet myself",
	"A picnic that turned into stargazing",
	"Finding a bench with the best view",
	"A voice crack during karaoke that made everyone laugh",
	"A long phone call with my sibling",
	"Trying a food I thought I'd hate",
	"A yoga class that loosened everything",
	"Writing down three good things before sleep",
] as const;

export function syntheticDailyAnswer(profileId: number, date = utcToday()): string {
	let hash = profileId;

	for (const char of date) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}

	return SYNTHETIC_DAILY_ANSWERS[hash % SYNTHETIC_DAILY_ANSWERS.length];
}

export async function resolveCandidateDailyAnswer(
	db: Db,
	profileId: number,
	isSynthetic: boolean,
	date = utcToday(),
): Promise<string | null> {
	if (isSynthetic) {
		return syntheticDailyAnswer(profileId, date);
	}

	const row = await dailyQuestionRepository.findAnswerForDate(db, profileId, date);
	const answer = row?.answer?.trim();

	return answer || null;
}
