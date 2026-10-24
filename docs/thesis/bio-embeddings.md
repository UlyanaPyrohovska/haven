# Thesis brief — Bio embeddings (W2.1) and how they relate to the text-mining course

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

**Script.** `research/embeddings/generate_embeddings.py` (dependencies in
`research/embeddings/requirements.txt`: `psycopg`, `pgvector`, `python-dotenv`,
`sentence-transformers`).

Pipeline:
1. Read `DATABASE_URL` from `apps/api/.env`, or from the file named by `ENV_FILE`. This is the
   same convention drizzle uses for migrations.
2. Select profiles that have a non-empty bio and no row in `user_embeddings`. This makes the run
   idempotent: re-running it only encodes what is missing.
3. Encode the bios in batches of 64 with `sentence-transformers/all-MiniLM-L6-v2`, using
   `normalize_embeddings=True`, so every vector has unit length.
4. Upsert `(user_profile_id, bio vector, updated_at)` into `user_embeddings`, committing after
   each batch. An interrupted run resumes where it stopped.
5. Print the runtime and 5 sample rows (vector dimension and squared norm) as the acceptance
   check.

**Storage.** `user_embeddings.bio` is a pgvector `vector(384)` column. It has an HNSW index with
`vector_cosine_ops` (`apps/api/src/db/schema.ts`), in Neon Postgres, `aws-eu-central-1`.

**Data.** The 2000 synthetic profiles come from `synthetic_users.csv`. They are derived from the
speed-dating dataset and their bios are text. Real users who sign up in the app are not embedded
at onboarding (see §5).

## 2. How the vector is used in matching

- `bioSimilarity(a, b)` in `apps/api/src/lib/scoring.ts` returns the cosine of the two
  embeddings, clamped to [0, 1]. It returns `null` if either side has no embedding.
- The directional score is
  `unilateral(u→v) = α·bio + w_interest·interest + w_geo·geo + w_pref·pref`, with
  `DEFAULT_WEIGHTS = { bio: 0.35, interest: 0.3, geo: 0.2, pref: 0.15 }`. The bio term is
  symmetric; only the preference term is asymmetric.
- **Missing-embedding rule:** if either user has no embedding, α is dropped and the other three
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

| Aspect | TF-IDF (course) | `all-MiniLM-L6-v2` (Haven) |
|---|---|---|
| Representation | Sparse; one dimension per vocabulary term (tens of thousands), almost all zero | Dense; fixed 384 dimensions, all non-zero |
| How the vector is obtained | Counted from the corpus: TF × IDF | Learned: a small transformer (6 layers) pre-trained on large text corpora and fine-tuned so that sentences with similar meaning land close together |
| Preprocessing | Required: cleaning, stopwords, stemming, n-grams | None; raw text goes in. The model has its own subword tokenizer |
| Synonyms and paraphrase | Not captured. "I love hiking in the mountains" and "trekking outdoors is my thing" share no terms, so their cosine is about 0 | Captured: the same pair scores high |
| Word order, context, negation | Lost (bag of words; bigrams keep only local order) | Kept: "not into sports" and "into sports" get different vectors |
| Dependence on the corpus | The IDF and the vocabulary depend on the whole corpus. Adding documents changes every vector, and unseen words are dropped | A vector depends only on its own text. The model is fixed, so vectors stay stable as new users join |
| Interpretability | High: you can list the terms that drove a match | Low: the dimensions are not human-readable |
| Cost and runtime | Pure arithmetic; could run inside the Cloudflare Worker | Needs a PyTorch runtime; runs offline in Python, not in the Worker |
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
at onboarding for real users inside the Worker without any third party. The embedding model is a
black box and inherits whatever biases its pre-training data has.

## 5. Data protection and design decisions

- **Local encoding only.** No external embedding API is used, because bios are personal data.
  Only the model weights are downloaded (from Hugging Face); no bio leaves the machine, and the
  database stays in the EU (Neon `aws-eu-central-1`).
- **Model choice.** `all-MiniLM-L6-v2` is small and fast on a CPU. Its 384 dimensions match the
  schema, and it is a standard model for semantic sentence similarity.
- **Unit normalisation.** Vectors are stored with unit length, so cosine similarity equals the
  dot product and pgvector's cosine distance is consistent with `bioSimilarity`.
- **Real users (known limitation).** Their bios are not embedded at onboarding. During the
  evaluation, real viewers are scored on interest, geo and preference, with α renormalised away.
  Future options, to mention as such and not as built:
  - a scheduled re-embed job;
  - Cloudflare Workers AI `@cf/baai/bge-small-en-v1.5`, which adds a subprocessor and so needs a
    DPO update;
  - a TF-IDF fallback computed in the Worker (the course method, with no third party).
- **Edited bios.** A profile that already has an embedding is not re-encoded when its bio
  changes. The script only fills missing rows.

## 6. Status, and what the report must not claim

- The script is written and its dependencies install. As of this writing it **has not been run**
  against the database, and **the runtime has not been recorded** (spec task W2.1 / backlog E1
  are `[~]`). Check `docs/path-a-implementation.md` W2.1 for the current status before quoting
  coverage or runtime.
- W2.2 (verifying that the cosine term is active, plus the mixed-pairing test) is still open.
- No measured comparison between TF-IDF and embeddings exists. Keep §4 argued, not empirical.
