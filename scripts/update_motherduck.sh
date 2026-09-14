#!/usr/bin/env bash
# Refresh the MotherDuck copy of the data from the published parquet.
#
# gs.malloy and md.malloy expose the same source names over two storages:
#
#   gs.malloy  duckdb.table('https://.../*.parquet')   -- read parquet directly
#   md.malloy  md.table('mayolo.*')                    -- read MotherDuck tables
#
# Only the parquet side gets refreshed automatically (refresh-data.yml rebuilds
# docs/ weekly and commits it, which republishes the GitHub Pages site), so the
# parquet is the source of truth and MotherDuck is the copy. This script makes
# the copy current, keeping the two storages interchangeable -- imdb.malloy
# switches between them with a one-line import change.
#
# Prereqs on PATH: bash, duckdb (>= 1.1, for the MotherDuck extension).
# Prereq in the environment: MOTHERDUCK_MALLOYYO_WRITE_TOKEN -- a read/write
# access token. Deliberately NOT the MOTHERDUCK_MALLOYYO_TOKEN that
# malloy-config.json hands the `md` connection: that one only needs to read,
# so it can stay a read-scaling token.
#
# Usage:
#   scripts/update_motherduck.sh                        # all tables, from Pages
#   scripts/update_motherduck.sh imdb_titles            # just these tables
#   scripts/update_motherduck.sh --source local         # from the docs/ checkout
#   scripts/update_motherduck.sh --source gcs           # from the GCS bucket
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

MD_DATABASE="mayolo"

# Where to read the parquet from.
#
#   pages  the published site -- what refresh-data.yml updates weekly. Default,
#          because it is the copy that is actually kept current.
#   local  docs/ in this checkout. Use right after running build_data.sh, to
#          push data that has not been committed/published yet.
#   gcs    the storage.googleapis.com/malloyyo bucket that gs.malloy reads.
#          Nothing updates this automatically -- only use it deliberately.
SOURCE="pages"
PAGES_BASE="https://lloydtabb.github.io/malloyyo-imdb"
GCS_BASE="https://storage.googleapis.com/malloyyo"
LOCAL_BASE="docs"

# target table in MotherDuck  ->  path of the parquet under the base.
# The names differ for people: md.table('mayolo.imdb_people') is what the
# parquet side publishes as imdb_names.parquet.
TABLES=(
  "imdb_titles:imdb_titles.parquet"
  "imdb_principals:imdb_principals.parquet"
  "imdb_people:imdb_names.parquet"
  "poster_paths:data/poster_paths.parquet"
)

# 1. Parse arguments: an optional --source, then an optional list of tables.
wanted=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE="${2:-}"
      shift 2
      ;;
    --source=*)
      SOURCE="${1#*=}"
      shift
      ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    -*)
      echo "error: unknown option '$1'" >&2
      exit 1
      ;;
    *)
      wanted+=("$1")
      shift
      ;;
  esac
done

case "$SOURCE" in
  pages) base="$PAGES_BASE" ;;
  gcs)   base="$GCS_BASE" ;;
  local) base="$LOCAL_BASE" ;;
  *)
    echo "error: --source must be one of: pages, local, gcs (got '$SOURCE')" >&2
    exit 1
    ;;
esac

# 2. Check the token and duckdb before doing anything slow.
if [[ -z "${MOTHERDUCK_MALLOYYO_WRITE_TOKEN:-}" ]]; then
  echo "error: MOTHERDUCK_MALLOYYO_WRITE_TOKEN is not set." >&2
  echo "       Create a read/write access token at" >&2
  echo "       https://app.motherduck.com/settings/tokens and export it:" >&2
  echo "         export MOTHERDUCK_MALLOYYO_WRITE_TOKEN=..." >&2
  exit 1
fi

if ! command -v duckdb >/dev/null 2>&1; then
  echo "error: duckdb is not on PATH (brew install duckdb)." >&2
  exit 1
fi

# The MotherDuck extension picks the token up from this env var.
export motherduck_token="$MOTHERDUCK_MALLOYYO_WRITE_TOKEN"

# 3. Pick the tables to load: all of them, or just the ones named as arguments.
selected=()
if [[ ${#wanted[@]} -eq 0 ]]; then
  selected=("${TABLES[@]}")
else
  for want in "${wanted[@]}"; do
    match=""
    for entry in "${TABLES[@]}"; do
      [[ "${entry%%:*}" == "$want" ]] && match="$entry"
    done
    if [[ -z "$match" ]]; then
      echo "error: unknown table '$want'. Known: ${TABLES[*]%%:*}" >&2
      exit 1
    fi
    selected+=("$match")
  done
fi

# 4. Build one SQL script: attach MotherDuck, then replace each table.
#    Attaching the database by name (not a bare 'md:') gives it its own
#    catalog, so mayolo.main.<table> is unambiguous -- and that is the same
#    table md.malloy reaches as md.table('mayolo.<table>').
#
#    CREATE OR REPLACE swaps each table in one step, so the tables stay
#    readable throughout and a failure part-way leaves the rest untouched.
sql=$(printf 'ATTACH IF NOT EXISTS '\''md:%s'\'';' "$MD_DATABASE")
for entry in "${selected[@]}"; do
  table="${entry%%:*}"
  path="${entry#*:}"
  # The GCS bucket is flat; pages and local keep posters under data/.
  [[ "$SOURCE" == "gcs" ]] && path="${path##*/}"
  url="$base/$path"
  echo "loading $url -> md:$MD_DATABASE.$table"
  sql+=$(printf '\nCREATE OR REPLACE TABLE %s.main.%s AS SELECT * FROM read_parquet('\''%s'\'');' \
    "$MD_DATABASE" "$table" "$url")
done

# 5. Report what landed, so a silently-empty load is visible.
for entry in "${selected[@]}"; do
  table="${entry%%:*}"
  sql+=$(printf '\nSELECT '\''%s.%s'\'' AS table_name, count(*) AS rows FROM %s.main.%s;' \
    "$MD_DATABASE" "$table" "$MD_DATABASE" "$table")
done

if ! duckdb -c "$sql"; then
  echo >&2
  echo "error: the load failed. If the message above says the database is attached" >&2
  echo "       read-only, MOTHERDUCK_MALLOYYO_WRITE_TOKEN is a read-scaling token" >&2
  echo "       -- writing needs a read/write access token." >&2
  exit 1
fi

echo "MotherDuck database '$MD_DATABASE' updated from $SOURCE."
