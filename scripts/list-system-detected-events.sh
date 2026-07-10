#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [limit]"
  echo "Example: $0 50"
}

LIMIT="${1:-100}"

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 1
fi

if [[ ! "$LIMIT" =~ ^[0-9]+$ || "$LIMIT" -eq 0 ]]; then
  echo "Erreur: la limite doit etre un nombre entier positif." >&2
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

docker exec "${DOCKER_TTY[@]}" "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT id
FROM system_event_logs
WHERE title IN ('Évènement système détecté', 'Événement système détecté')
ORDER BY event_timestamp DESC, received_at DESC, id DESC
LIMIT ${LIMIT};
"
