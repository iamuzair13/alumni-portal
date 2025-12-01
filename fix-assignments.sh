#!/bin/bash

# Fix Access Assignments - Run this script while logged in as superadmin
# Or use the API endpoint directly

echo "Fixing access assignments..."

# Replace with your actual domain/port
BASE_URL="http://localhost:3000"

# First, preview what will be updated
echo "Previewing assignments to be updated..."
curl -X GET "${BASE_URL}/api/fix-access-assignments" \
  -H "Content-Type: application/json" \
  -b "authjs.session-token=YOUR_SESSION_TOKEN" \
  | jq .

# Then apply the fix
echo ""
echo "Applying the fix..."
curl -X POST "${BASE_URL}/api/fix-access-assignments" \
  -H "Content-Type: application/json" \
  -b "authjs.session-token=YOUR_SESSION_TOKEN" \
  | jq .

echo ""
echo "Done! Check /api/debug/access-filter to verify."

