#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env file not found at $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck source=.env
source "$ENV_FILE"
set +a

echo "=== RepairFund Admin Password Reset ==="
echo ""

# Verify containers are running
if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps --status running | grep -q "app"; then
  echo "Error: App container is not running. Start with: docker compose up -d" >&2
  exit 1
fi

read -rsp "New password (min 8 chars): " NEW_PASS
echo ""
read -rsp "Confirm new password:        " CONFIRM_PASS
echo ""

if [[ "$NEW_PASS" != "$CONFIRM_PASS" ]]; then
  echo "Error: Passwords do not match." >&2
  exit 1
fi

if [[ ${#NEW_PASS} -lt 8 ]]; then
  echo "Error: Password must be at least 8 characters." >&2
  exit 1
fi

echo "Generating bcrypt hash..."

# Pass the password via env var to avoid shell injection
HASH=$(NEW_PASS="$NEW_PASS" docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T \
  -e NEW_PASS \
  app node --input-type=module -e \
  "import bcrypt from 'bcryptjs'; bcrypt.hash(process.env.NEW_PASS, 10).then(h => process.stdout.write(h));")

if [[ -z "$HASH" ]]; then
  echo "Error: Failed to generate password hash." >&2
  exit 1
fi

echo "Updating database..."

ROWS=$(docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T db \
  mariadb -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" --skip-column-names -e \
  "UPDATE users SET password_hash='$HASH', force_password_change=TRUE
   WHERE username='admin' AND role='admin';
   SELECT ROW_COUNT();")

if [[ "$ROWS" -eq 0 ]]; then
  echo "Warning: No admin user found — password was not changed." >&2
  exit 1
fi

echo ""
echo "Admin password reset. The admin must change it again on next login."
