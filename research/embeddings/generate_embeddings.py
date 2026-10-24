"""W2.1 / E1 — embed user bios locally with all-MiniLM-L6-v2 and store them in user_embeddings.

Runs on this machine only: bios are never sent to an external API (DPO, data stays in the EU).
Idempotent: only profiles with a bio and no embedding, or a profile edited since its embedding, are
encoded; embeddings whose bio was cleared are deleted. Re-run after participants onboard or edit a bio.

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python generate_embeddings.py                         # apps/api/.env
    ENV_FILE=.env.dev .venv/bin/python generate_embeddings.py       # any apps/api/.env* file
"""

import os
import time
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"  # 384-d, matches user_embeddings.bio vector(384)
BATCH_SIZE = 64

# profile.updated_at bumps on any profile edit, so this over-selects a little; re-encoding is cheap.
SELECT_STALE = """
	SELECT p.id, p.bio FROM user_profiles p
	LEFT JOIN user_embeddings e ON e.user_profile_id = p.id
	WHERE p.bio IS NOT NULL AND btrim(p.bio) <> ''
	  AND (e.user_profile_id IS NULL OR p.updated_at > e.updated_at)
	ORDER BY p.id
"""

DELETE_CLEARED = """
	DELETE FROM user_embeddings e USING user_profiles p
	WHERE e.user_profile_id = p.id AND (p.bio IS NULL OR btrim(p.bio) = '')
"""

UPSERT = """
	INSERT INTO user_embeddings (user_profile_id, bio, updated_at)
	VALUES (%s, %s, now())
	ON CONFLICT (user_profile_id) DO UPDATE SET bio = EXCLUDED.bio, updated_at = EXCLUDED.updated_at
"""


def main() -> None:
	# Same convention as apps/api/drizzle.config.ts: ENV_FILE picks the target database.
	api_dir = Path(__file__).resolve().parents[2] / "apps" / "api"
	load_dotenv(api_dir / os.environ.get("ENV_FILE", ".env"), override=True)
	database_url = os.environ.get("DATABASE_URL")
	if not database_url:
		raise SystemExit("Missing env variable: DATABASE_URL")

	started = time.perf_counter()
	with psycopg.connect(database_url) as conn:
		register_vector(conn)
		cleared = conn.execute(DELETE_CLEARED).rowcount
		conn.commit()
		print(f"{cleared} embeddings removed (bio cleared)")
		rows = conn.execute(SELECT_STALE).fetchall()
		print(f"{len(rows)} profiles need an embedding")
		if not rows:
			return

		model = SentenceTransformer(MODEL_NAME)
		encode_started = time.perf_counter()
		for i in range(0, len(rows), BATCH_SIZE):
			batch = rows[i : i + BATCH_SIZE]
			# Unit-normalized so cosine distance in pgvector equals 1 - dot product.
			vectors = model.encode([bio for _, bio in batch], normalize_embeddings=True)
			with conn.cursor() as cur:
				cur.executemany(UPSERT, [(pid, vec) for (pid, _), vec in zip(batch, vectors)])
			conn.commit()  # commit per batch so an interrupted run resumes where it stopped
			print(f"  {min(i + BATCH_SIZE, len(rows))}/{len(rows)}")
		encode_secs = time.perf_counter() - encode_started

		sample = conn.execute(
			"SELECT user_profile_id, vector_dims(bio), round((bio <#> bio)::numeric, 4) FROM user_embeddings LIMIT 5"
		).fetchall()

	print(f"encode+write: {encode_secs:.1f}s, total: {time.perf_counter() - started:.1f}s")
	print("sample (profile id, dims, -|v|^2):", sample)


if __name__ == "__main__":
	main()
