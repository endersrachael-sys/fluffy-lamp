#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Checking $BASE_URL/api/health"
curl -fsS "$BASE_URL/api/health" | grep -q 'JarDIYn'
echo "health ok"

echo "Checking $BASE_URL/api/tools"
curl -fsS "$BASE_URL/api/tools" | grep -q 'plan_check'
echo "tools ok"

echo "Checking chat"
curl -fsS -X POST "$BASE_URL/api/chat" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Plan Check: I want pollinators in clay soil.","profile":{"zip_code":"49503","soil_type":"clay","goals":["pollinators"]}}' | grep -q 'plan_check'
echo "chat ok"
