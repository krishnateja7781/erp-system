#!/usr/bin/env bash
# Runs the database test-suite against a THROWAWAY local PostgreSQL (never your Supabase project).
#   PGHOST/PGPORT/PGUSER select the server (default localhost:5432 postgres). Needs psql (+ pgbench for --load).
#   Usage: database/tests/run.sh [--load]
set -euo pipefail
cd "$(dirname "$0")"
DB=eduerp_test
export PGOPTIONS="-c client_min_messages=warning"   # hide idempotent "already exists" notices
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -d $DB -v ON_ERROR_STOP=1 -f 00_supabase_stub.sql >/dev/null 2>&1
for f in ../0*.sql; do psql -q -d $DB -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
for f in ../0*.sql; do psql -q -d $DB -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done   # idempotency
fail=0
for t in 10_functional 20_automation 40_reads_and_edges 50_identifiers_and_backlogs 30_cascade; do
  out=$(psql -q -d $DB -f "$t.sql" 2>&1 || true)
  printf '%-28s %3s passed  %s\n' "$t" "$(grep -c 'NOTICE:  ok' <<<"$out")" "$(grep -m1 ERROR <<<"$out" || echo OK)"
  grep -q ERROR <<<"$out" && fail=1
done
if [[ "${1:-}" == "--load" ]]; then
  psql -q -d $DB -c "drop schema public cascade; create schema public" >/dev/null
  psql -q -d $DB -c "drop schema if exists auth cascade; drop schema if exists storage cascade" >/dev/null
  psql -q -d $DB -f 00_supabase_stub.sql >/dev/null 2>&1 || true
  for f in ../0*.sql; do psql -q -d $DB -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
  psql -q -d $DB -f 10_functional.sql >/dev/null 2>&1
  psql -q -d $DB -f load/scale_setup.sql
  psql -q -d $DB -c "insert into hostel_rooms (id, hostel_id, room_number, capacity) values ('51000000-0000-0000-0000-0000000000aa', '50000000-0000-0000-0000-000000000001', 'LOAD', 4)"
  for t in join pay apply room ids; do echo "== $t"; pgbench -n -c 50 -j 8 -t 100 -f "load/concurrent_$t.sql" $DB | grep -E "failed|latency average|tps"; done
fi
exit $fail
