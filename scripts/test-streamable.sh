#!/bin/bash
set -e

BASE="http://localhost:3001"

# Create room
ROOM=$(curl -sS -X POST "$BASE/api/rooms" -H 'Content-Type: application/json' -d '{"name":"streamable-e2e"}')
ROOM_ID=$(echo "$ROOM" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Room ID: $ROOM_ID"
echo "mcpEndpoint: $(echo "$ROOM" | python3 -c "import sys,json; print(json.load(sys.stdin)['mcpEndpoint'])")"

# Step 1: Initialize
echo ""
echo "=== Step 1: MCP Initialize ==="
curl -sS -X POST "$BASE/mcp/$ROOM_ID" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -D /tmp/mcp-headers.txt \
  -o /tmp/mcp-init.txt \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-03-26\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}"

SESSION=$(grep -i 'mcp-session-id' /tmp/mcp-headers.txt | tr -d '\r\n' | awk '{print $2}')
echo "Session: $SESSION"

# Step 2: Initialized notification
echo ""
echo "=== Step 2: Send initialized notification ==="
curl -sS -X POST "$BASE/mcp/$ROOM_ID" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" \
  -o /dev/null -w "HTTP %{http_code}" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
echo ""

# Step 3: get_my_status
echo ""
echo "=== Step 3: Call get_my_status ==="
curl -sS -X POST "$BASE/mcp/$ROOM_ID" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" \
  -o /tmp/mcp-status.txt \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"get_my_status\",\"arguments\":{}}}"

# Extract the text content from SSE response
grep -o '"text":"[^"]*' /tmp/mcp-status.txt | head -1 | sed 's/"text":"//' | python3 -c "
import sys, json
raw = sys.stdin.read()
try:
    data = json.loads(raw)
    print(json.dumps(data, indent=2))
except:
    print(raw[:500])
"

# Step 4: Move
echo ""
echo "=== Step 4: Call move ==="
curl -sS -X POST "$BASE/mcp/$ROOM_ID" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" \
  -o /tmp/mcp-move.txt \
  -d "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"move\",\"arguments\":{\"direction\":\"down\"}}}"
grep -o '"text":"[^"]*' /tmp/mcp-move.txt | head -1 | sed 's/"text":"//'

echo ""
echo "=== DONE ==="
