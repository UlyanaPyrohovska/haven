#!/bin/bash
# usage: run-extra.sh <seed|orig> <pool>   (DATA and OUT override the defaults below)
cd "$(dirname "$0")"
DATA=${DATA:-../eval-out/dev.json}
OUT=${OUT:-../eval-out/extra}
mkdir -p "$OUT"
S=$1; [ "$S" = orig ] && S=
SIM_SEED=$S SIMV=geo,cap14,cap28 THETA=0.79 npx tsx extra-variants.ts "$DATA" "$OUT/extra-$1-$2.json" 14 300 $2 > "$OUT/extra-$1-$2.log" 2>&1
echo "EXIT $?" >> "$OUT/extra-$1-$2.log"
