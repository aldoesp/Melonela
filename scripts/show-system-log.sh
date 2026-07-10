#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <system_event_log_id>"
  echo "Example: $0 123"
}

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

LOG_ID="$1"

if [[ ! "$LOG_ID" =~ ^[0-9]+$ ]]; then
  echo "Erreur: l'ID doit etre un nombre entier positif." >&2
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DB_USER="${DB_USER:-aldoesp}"
DB_NAME="${DB_NAME:-melonela_audit}"
DB_CONTAINER="${DB_CONTAINER:-melonela_postgres}"

DOCKER_TTY=()
if [[ -t 0 && -t 1 ]]; then
  DOCKER_TTY=(-it)
fi

docker exec "${DOCKER_TTY[@]}" "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -x -c "
SELECT
  id,
  source_name,
  source_type,
  service,
  process_name,
  process_id,
  host_name,
  event_type,
  severity,
  username,
  tty,
  working_directory,
  target_user,
  command,
  message,
  title,
  description,
  category,
  icon,
  human_severity,
  interpretation_rule_id,
  interpretation_confidence,
  event_timestamp,
  received_at,
  created_at,
  jsonb_pretty(raw_payload) AS raw_payload,
  jsonb_pretty(normalized_payload) AS normalized_payload
FROM system_event_logs
WHERE id = ${LOG_ID};
"
