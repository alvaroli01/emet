#!/usr/bin/env bash
# Runs the permission tests on a throwaway local Postgres (no Supabase account needed).
# Usage: bash supabase/tests/run-local.sh      — prints PASS/FAIL per test, exits 1 on any FAIL.
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}
DATA=$(mktemp -d)
PORT=${PORT:-54329}
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT

"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start >/dev/null

run() { psql -tA -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
run -f tests/supabase_mock.sql
for f in migrations/*.sql; do run -f "$f"; done
run -f seed.sql

OUT=$(run -f tests/permissions_test.sql 2>&1 | sed -e "s/.*NOTICE:  //" | grep -E "^(PASS|FAIL)|ERROR" || true)
echo "$OUT"
PASS=$(grep -c '^PASS' <<<"$OUT" || true)
FAIL=$(grep -cE '^FAIL|ERROR' <<<"$OUT" || true)
echo; echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
