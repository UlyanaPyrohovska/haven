"""W2.1 / E1 — embed user bios locally with all-MiniLM-L6-v2 and store them in user_embeddings.

Runs on this machine only: bios are never sent to an external API (DPO, data stays in the EU).
Idempotent: only profiles with a bio and no embedding row are encoded.

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

SELECT_MISSING = """
	SELECT id, bio FROM user_profiles
	WHERE bio IS NOT NULL AND btrim(bio) <> ''
	  AND id NOT IN (SELECT user_profile_id FROM user_embeddings)
	ORDER BY id
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
		rows = conn.execute(SELECT_MISSING).fetchall()
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
