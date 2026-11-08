#!/bin/bash
# usage: run-seed.sh <seed> <pool>   (DATA and OUT override the defaults below)
cd "$(dirname "$0")"
DATA=${DATA:-../eval-out/dev.json}
OUT=${OUT:-../eval-out/seeds}
mkdir -p "$OUT"
SIM_SEED=$1 THETA=0.79 npx tsx sim.ts "$DATA" "$OUT/sim-$1-$2.json" 14 300 $2 > "$OUT/sim-$1-$2.log" 2>&1
echo "EXIT $?" >> "$OUT/sim-$1-$2.log"
