#!/bin/sh
# Deploy the Worker pointed at the database in the given env file: sh scripts/deploy.sh .env.prod
# Only DATABASE_URL is uploaded; the env files' BETTER_AUTH_URL is localhost and must not reach the Worker.
set -e
env_file="$1"
[ -f "$env_file" ] || { echo "Usage: sh scripts/deploy.sh <env-file>" >&2; exit 1; }
secrets=.env.deploy
trap 'rm -f "$secrets"' EXIT
grep '^DATABASE_URL=' "$env_file" > "$secrets" || { echo "No DATABASE_URL in $env_file" >&2; exit 1; }
wrangler deploy --minify --secrets-file "$secrets"
