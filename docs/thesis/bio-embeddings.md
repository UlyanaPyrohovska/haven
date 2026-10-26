# Thesis brief — Bio embeddings (W2.1, T9) and how they relate to the text-mining course

Handoff for whoever writes the thesis report. It covers what was built, why it was built that
way, and how it differs from the classical text-mining pipeline the author implemented during
the master's (EAI course project, `/Users/uliana/Desktop/personal/eai-project`). The supervisor
asked that the thesis show skills learned during the master's, so the report should present the
course pipeline as the conceptual foundation and sentence embeddings as the method chosen for
Haven.

**Scope decision:** no empirical TF-IDF vs. embedding comparison was run or is planned. The
comparison in the report is conceptual and argued, not measured. Do not invent numbers for it.

---

## 1. What was built

**Goal.** Give every profile with a bio a semantic vector, so the bio term of the compatibility
score (`bio` weight α in `scoring.ts`) can be used.

**History.** The first version (W2.1) was a local Python script with
`sentence-transformers/all-MiniLM-L6-v2`, run by hand against the database. Real users' new or
edited bios got no vector until someone re-ran it. T9 (2026-10-26) replaced it: bios are now
embedded inside the API Worker with Cloudflare Workers AI `@cf/baai/bge-small-en-v1.5`, and the
script was removed. All vectors come from bge-small; the two models are never mixed (see §5).

**Pipeline (current).**
1. **On profile write.** When a profile is created or edited and the request changes the bio,
   `patchProfile` (`apps/api/src/modules/profile/service.ts`) schedules `syncBioEmbedding`
   (`apps/api/src/lib/bio-embedding.ts`) with `executionCtx.waitUntil`. The save returns at once;
   the embedding runs after the response.
2. `syncBioEmbedding` sends the bio text to bge-small (`embedTexts`), checks that the result is a
   384-d vector, and upserts `(user_profile_id, bio vector, updated_at)` into `user_embeddings`.
   A cleared bio deletes the row instead.
3. **Failures never fail the save.** Any error is logged and the profile keeps no vector; the
   scorer already treats a missing vector as neutral (§2).
4. **Backfill.** A staff-only route, `POST /staff/embeddings/backfill`, re-embeds every non-empty
   bio in batches of 100 (the model's per-call limit) and deletes vectors of cleared bios. It is
   run once per environment and after every reseed of the synthetic data.
5. Tests with a mocked Workers AI binding cover the upsert, delete, failure and wrong-dimension
   paths (`bio-embedding.test.ts`).

**Storage.** `user_embeddings.bio` is a pgvector `vector(384)` column. It has an HNSW index with
`vector_cosine_ops` (`apps/api/src/db/schema.ts`), in Neon Postgres, `aws-eu-central-1`.

**Data.** The 2000 synthetic profiles come from `synthetic_users.csv`. They are derived from the
speed-dating dataset and their bios are text. Real users who sign up in the app are embedded
from their first bio save (see §5).

## 2. How the vector is used in matching

- `bioSimilarity(a, b)` in `apps/api/src/lib/scoring.ts` returns the cosine of the two
  embeddings, clamped to [0, 1]. It returns `null` if either side has no embedding.
- The directional score is
  `unilateral(u→v) = α·bio + w_interest·interest + w_geo·geo + w_pref·pref + w_mood·mood +
  w_daily·dailyAnswer`, with `DEFAULT_WEIGHTS = { bio: 0.3, interest: 0.25, geo: 0.15,
  pref: 0.15, mood: 0.05, dailyAnswer: 0.1 }`. The bio term is symmetric; only the preference
  term is asymmetric.
- **Missing-embedding rule:** if either user has no embedding, α is dropped and the remaining
  weights are renormalized to sum to 1. A user without a bio vector is therefore scored on the
  other signals and is not penalised with a zero.
- **Reciprocal score:** the harmonic mean of `unilateral(u→v)` and `unilateral(v→u)`, so both
  sides must find each other compatible.
- **Retrieval:** if the viewer has an embedding, the candidate pool is pre-ranked with the HNSW
  index (`ORDER BY bio <=> viewer LIMIT 200`, `ANN_SHORTLIST_LIMIT`) before full scoring. This is
  approximate nearest-neighbour search, a scale path for when the pool grows
  (`apps/api/src/modules/recommendations/repository.ts`, `generator.ts`).

## 3. The text-mining approach from the master's (EAI course project)

TypeScript implementation (`eai-project/src/classification/`), used to classify documents:

1. **Cleaning** (`clean.ts`): lowercase, strip HTML tags, remove non-letters, collapse spaces.
2. **Stopword removal** (`stopwords.ts`, `stopword` package, plus optional custom lists).
3. **Stemming** (`stemmer.ts`, Porter stemmer): "hiking", "hikes" and "hiked" all become "hike".
4. **Tokenisation into n-grams** (`tokenization.ts`): unigrams and bigrams.
5. **TF-IDF weighting**: term frequency × inverse document frequency.
6. **Feature selection**: per class, sum the TF-IDF values of each n-gram and keep the most
   representative ones. Minimum document frequency was 4 for unigrams and 1 for bigrams.
7. **Classification**: Naive Bayes with TF-IDF class profiles, and cosine similarity between a
   document's TF-IDF vector and an average vector per class (`cosineSimilarity.ts`).
8. **Evaluation**: confusion matrix, accuracy, precision, recall, F1. Results were about 72%
   accuracy for Naive Bayes and about 69% for cosine similarity.

This is the classical **vector space model**: a document becomes a vector of weighted terms, and
documents are compared by cosine similarity.

## 4. How the two approaches differ

**Core difference: TF-IDF compares words; sentence embeddings compare meaning.**

| Aspect | TF-IDF (course) | `bge-small-en-v1.5` (Haven) |
|---|---|---|
| Representation | Sparse; one dimension per vocabulary term (tens of thousands), almost all zero | Dense; fixed 384 dimensions, all non-zero |
| How the vector is obtained | Counted from the corpus: TF × IDF | Learned: a small transformer pre-trained on large text corpora and contrastively fine-tuned so that sentences with similar meaning land close together |
| Preprocessing | Required: cleaning, stopwords, stemming, n-grams | None; raw text goes in. The model has its own subword tokenizer |
| Synonyms and paraphrase | Not captured. "I love hiking in the mountains" and "trekking outdoors is my thing" share no terms, so their cosine is about 0 | Captured: the same pair scores high |
| Word order, context, negation | Lost (bag of words; bigrams keep only local order) | Kept: "not into sports" and "into sports" get different vectors |
| Dependence on the corpus | The IDF and the vocabulary depend on the whole corpus. Adding documents changes every vector, and unseen words are dropped | A vector depends only on its own text. The model is fixed, so vectors stay stable as new users join |
| Interpretability | High: you can list the terms that drove a match | Low: the dimensions are not human-readable |
| Cost and runtime | Pure arithmetic; could run inside the Cloudflare Worker with no third party | Needs GPU/ML inference; too large to bundle in the Worker, so it is called as a hosted model (Workers AI) |
| Storage and search | Would need `sparsevec` and a vocabulary that keeps growing | Fits `vector(384)` and the pgvector HNSW cosine index directly |
| Similarity measure | Cosine | Cosine (the same idea, unchanged) |

**Why embeddings fit Haven's bios better.**
- **Bios are short** (one to three sentences). Two people rarely use the same words, so TF-IDF
  vectors barely overlap and most pairs score close to 0. Semantic overlap still exists, and
  embeddings recover it.
- **Matching is not classification.** The course task assigned a document to a known class,
  where feature selection per class helps. Haven needs a graded similarity between two arbitrary
  people, with no classes. A general-purpose semantic space suits that better than class-specific
  selected terms.
- **Fixed dimension.** It fits the database index and the existing scoring function.

**The continuity to stress in the report.** The embedding approach keeps the backbone of the
course pipeline: text becomes a vector, and vectors are compared by cosine similarity. What
changes is how the vector space is built. It is learned from data instead of counted from a
corpus. The manual preprocessing steps from the course (stopwords, stemming, n-grams) are
replaced by what the transformer has learned, for example that "hike" and "trek" are related.
The course pipeline is the baseline concept, and the embedding is the modern instance of the
same vector-space idea.

**Fair trade-offs to acknowledge.** TF-IDF stays more explainable and cheaper, and it could run
inside the Worker without any third party; the embedding needs an external inference service. The embedding model is a
black box and inherits whatever biases its pre-training data has.

## 5. Data protection and design decisions

- **From local to hosted inference.** W2.1 encoded bios locally so that no bio left the machine.
  That left real users without vectors. T9 moved encoding into the Worker with Cloudflare Workers
  AI, which makes Cloudflare a subprocessor for bio text. The DPO signed off on this before it was
  built. Workers AI does not guarantee EU-only inference, so a bio may be processed outside the
  EU. Only the bio text is sent (no name, id or other profile field), and only the resulting
  vector is stored, in Neon `aws-eu-central-1`.
- **Why not run the model in the Worker.** MiniLM is about 23 MB and transformer inference exceeds
  Worker size and CPU limits, so an in-Worker model was not practical.
- **Model choice.** `bge-small-en-v1.5` is a small English sentence-embedding model available on
  Workers AI. Its 384 dimensions match the existing `vector(384)` column, so no schema change was
  needed.
- **One model only.** bge-small and MiniLM vectors both have 384 dimensions but live in different
  spaces, so a cosine between them is meaningless. The backfill re-embeds every row with bge-small
  and the MiniLM script was removed.
- **Normalisation.** `bioSimilarity` computes the full cosine (dot product over the norms), and
  pgvector's cosine distance is also norm-independent, so stored vectors need not be unit length.
- **Edited and cleared bios.** Every bio change re-embeds the profile; clearing the bio deletes
  its vector.
- **Robustness.** Embedding runs after the response and never fails a save. A failed call leaves
  the profile without a vector, which the scorer handles by renormalising (§2).
- **Alternative not built:** a TF-IDF fallback computed in the Worker (the course method, with no
  third party).

## 6. Status, and what the report must not claim

- The Worker embedding (T9) is implemented and unit-tested. Check `BACKLOG.md` T9 and
  `docs/FEATURES.md` (Bio embeddings) for whether the bge-small backfill has been run on each
  environment before claiming full coverage.
- The W2.1 MiniLM run on dev (2002 bios, 21 s encode+write) describes the earlier local
  pipeline. Do not quote it as the runtime of the current Workers AI pipeline; no runtime has
  been recorded for that.
- No measured comparison between TF-IDF and embeddings exists. Keep §4 argued, not empirical.
