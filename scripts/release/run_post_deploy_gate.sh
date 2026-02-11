#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql no está instalado o no está en PATH." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: define DATABASE_URL para ejecutar el gate SQL post-deploy." >&2
  exit 1
fi

CHECK_FILE="supabase/checks/post_deploy_audit.sql"

if [[ ! -f "$CHECK_FILE" ]]; then
  echo "Error: no se encontró $CHECK_FILE" >&2
  exit 1
fi

TMP_OUTPUT="$(mktemp)"
trap 'rm -f "$TMP_OUTPUT"' EXIT

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -f "$CHECK_FILE" > "$TMP_OUTPUT"

if [[ ! -s "$TMP_OUTPUT" ]]; then
  echo "Error: el checklist no devolvió filas. Revisar permisos/entorno." >&2
  exit 1
fi

echo "Resultado de $CHECK_FILE:"
awk -F'|' '{ printf("- %s => %s (%s)\n", $1, $2, $3) }' "$TMP_OUTPUT"

FAIL_COUNT="$(awk -F'|' '$2 == "FAIL" { c++ } END { print c + 0 }' "$TMP_OUTPUT")"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "\nGate bloqueado: se detectaron $FAIL_COUNT checks en FAIL. No cerrar release." >&2
  exit 1
fi

echo "\nGate aprobado: 0 checks FAIL."
