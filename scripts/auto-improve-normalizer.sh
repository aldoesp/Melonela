#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/auto-improve-normalizer.sh <max_events> [--dry-run]

Examples:
  ./scripts/auto-improve-normalizer.sh 1
  ./scripts/auto-improve-normalizer.sh 3
  ./scripts/auto-improve-normalizer.sh 1 --dry-run
USAGE
}

MAX_EVENTS=""
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    -*)
      echo "Erreur: option inconnue: ${arg}" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -n "$MAX_EVENTS" ]]; then
        echo "Erreur: un seul nombre maximum d'evenements est accepte." >&2
        usage >&2
        exit 1
      fi
      MAX_EVENTS="$arg"
      ;;
  esac
done

if [[ -z "$MAX_EVENTS" ]]; then
  echo "Erreur: le nombre maximum d'evenements est obligatoire." >&2
  usage >&2
  exit 1
fi

if [[ ! "$MAX_EVENTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Erreur: le nombre maximum d'evenements doit etre un entier positif." >&2
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="/tmp/melonela-normalizer-agent"

resolve_helper_script() {
  local script_name="$1"
  local root_candidate="${PROJECT_ROOT}/${script_name}"
  local scripts_candidate="${SCRIPT_DIR}/${script_name}"

  # Prefer the documented project-root location, but support the existing
  # repository layout where helper scripts live in scripts/.
  if [[ -x "$root_candidate" ]]; then
    printf '%s\n' "$root_candidate"
    return 0
  fi

  if [[ -x "$scripts_candidate" ]]; then
    printf '%s\n' "$scripts_candidate"
    return 0
  fi

  echo "Erreur: ${script_name} est introuvable ou non executable." >&2
  echo "Chemins verifies:" >&2
  echo "  - ${root_candidate}" >&2
  echo "  - ${scripts_candidate}" >&2
  exit 1
}

LIST_SCRIPT="$(resolve_helper_script "list-system-detected-events.sh")"
SHOW_SCRIPT="$(resolve_helper_script "show-system-log.sh")"

if [[ "$DRY_RUN" -eq 0 ]]; then
  mkdir -p "$TMP_DIR"
fi

SELECTED_IDS=()
PROMPTS_GENERATED=0

id_already_selected() {
  local candidate="$1"
  local selected

  for selected in "${SELECTED_IDS[@]}"; do
    if [[ "$selected" == "$candidate" ]]; then
      return 0
    fi
  done

  return 1
}

extract_first_available_id() {
  local list_output="$1"
  local candidate

  # psql table output includes headers, separators and row counts. IDs are the
  # only useful lines made solely of digits, so this remains stable across
  # aligned psql output variations.
  while IFS= read -r candidate; do
    if [[ "$candidate" =~ ^[[:space:]]*([0-9]+)[[:space:]]*$ ]]; then
      candidate="${BASH_REMATCH[1]}"
      if ! id_already_selected "$candidate"; then
        printf '%s\n' "$candidate"
        return 0
      fi
    fi
  done <<< "$list_output"

  return 1
}

write_prompt() {
  local event_id="$1"
  local event_file="$2"
  local prompt_file="$3"

  cat > "$prompt_file" <<PROMPT
# Mission Codex: ameliorer un seul fingerprint du normalizer Melonela

Tu es dans le backend CommonJS JavaScript de Melonela.

Evenement cible:
- ID: ${event_id}
- Detail complet du log: ${event_file}

Objectif:
Traiter uniquement ce fingerprint logique afin que l'evenement ${event_id} ne soit plus interprete avec \`fallback_generic\` / "Evenement systeme detecte".

Contraintes strictes:
- Analyse uniquement les champs \`message\`, \`service\`, \`process_name\`, \`normalized_payload\`, \`raw_payload\`.
- N'utilise pas les champs temporels, l'ID, l'hote, la severite deja normalisee, le titre ou la description comme signal de classification.
- Ne traite qu'un seul fingerprint logique.
- Ne modifie pas la base de donnees.
- Backend Node.js CommonJS JavaScript, pas de TypeScript.
- Reste conservateur: ne cree pas de regle trop large.

Travail demande:
1. Lire le detail du log dans \`${event_file}\`.
2. Identifier le pattern general observable dans les champs autorises.
3. Identifier le fingerprint logique minimal et stable.
4. Verifier s'il existe deja une regle similaire dans \`backend/src/logs/normalizers/\`.
5. Ajouter ou ameliorer une regle CommonJS seulement si necessaire.
6. Ajouter ou mettre a jour un test unitaire couvrant ce fingerprint.
7. Lancer les tests pertinents.
8. Verifier explicitement que l'ID ${event_id} ne tombe plus sur \`fallback_generic\`.

Livrable attendu:
- Resume court du fingerprint traite.
- Fichiers modifies.
- Commandes de test lancees et resultat.
- Confirmation de la verification anti-\`fallback_generic\`.
PROMPT
}

for ((loop_index = 1; loop_index <= MAX_EVENTS; loop_index++)); do
  echo "Boucle ${loop_index}/${MAX_EVENTS}"

  # Ask for a wider list than the requested count so this script can skip IDs
  # already selected during the current run without mutating backend state.
  LIST_LIMIT=$((MAX_EVENTS * 5))
  if (( LIST_LIMIT < 20 )); then
    LIST_LIMIT=20
  fi

  LIST_OUTPUT="$("$LIST_SCRIPT" "$LIST_LIMIT")"

  if ! EVENT_ID="$(extract_first_available_id "$LIST_OUTPUT")"; then
    echo "Aucun ID exploitable restant. Arret propre."
    break
  fi

  SELECTED_IDS+=("$EVENT_ID")
  EVENT_FILE="${TMP_DIR}/event-${EVENT_ID}.txt"
  PROMPT_FILE="${TMP_DIR}/prompt-${EVENT_ID}.md"

  echo "ID selectionne: ${EVENT_ID}"
  echo "Detail du log: ${EVENT_FILE}"
  echo "Prompt Codex: ${PROMPT_FILE}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Dry-run: aucun fichier n'est cree et show-system-log n'est pas execute."
    echo
    continue
  fi

  "$SHOW_SCRIPT" "$EVENT_ID" > "$EVENT_FILE"
  write_prompt "$EVENT_ID" "$EVENT_FILE" "$PROMPT_FILE"
  PROMPTS_GENERATED=$((PROMPTS_GENERATED + 1))
  echo
done

IDS_SUMMARY="aucun"
if [[ "${#SELECTED_IDS[@]}" -gt 0 ]]; then
  IDS_SUMMARY="${SELECTED_IDS[*]}"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  PROMPTS_GENERATED="${#SELECTED_IDS[@]} (dry-run, non ecrits)"
fi

cat <<SUMMARY
Resume:
- Boucles demandees: ${MAX_EVENTS}
- Prompts generes: ${PROMPTS_GENERATED}
- IDs selectionnes: ${IDS_SUMMARY}
- Dossier temporaire utilise: ${TMP_DIR}
SUMMARY
