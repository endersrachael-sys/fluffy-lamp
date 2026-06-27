#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
echo "Smoke testing $BASE_URL"
curl -fsS "$BASE_URL/api/health" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); if(j.status!=="ok") process.exit(1); console.log("health ok")})'
curl -fsS "$BASE_URL/api/tools" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); if(!j.count||j.count<7) process.exit(1); console.log("tools ok", j.count)})'
curl -fsS -X POST "$BASE_URL/api/chat" -H 'content-type: application/json' -d '{"message":"Plan Check: what will fail in clay shade?","garden_profile":{"zip_code":"49503","soil_type":"clay loam","sun_exposure":"partial_shade","goals":["pollinators"],"maintenance_tolerance":"low"},"session_id":"smoke"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); if(!j.answer||!j.requestId) process.exit(1); console.log("chat ok", j.requestId)})'
echo "Smoke test passed."
